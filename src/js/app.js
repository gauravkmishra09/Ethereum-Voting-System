/* JanVote frontend: preserves the deployed Sepolia contract. */
var App = {
  web3Provider: null,
  contracts: {},
  account: null,
  chainId: null,
  candidates: [],
  selectedCandidate: null,
  hasVoted: false,
  stream: null,
  parties: {
    1: {party:"Bharatiya Janata Party (BJP)", short:"BJP", color:"#f47721", logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Lotus_flower_symbol.svg"},
    2: {party:"Indian National Congress (INC)", short:"INC", color:"#16834a", logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Indian_National_Congress_hand_logo.svg"},
    3: {party:"Aam Aadmi Party (AAP)", short:"AAP", color:"#2846b8", logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Aam_Aadmi_Party_logo_(English).svg"},
    4: {party:"All India Trinamool Congress (TMC)", short:"TMC", color:"#00a7d8", logo:"https://commons.wikimedia.org/wiki/Special:FilePath/All_India_Trinamool_Congress_logo.svg"}
  },
  init: async function() {
    $("#voteButton").on("click", App.castVote);
    $("#startCamera").on("click", App.startCamera);
    $("#stopCamera").on("click", App.stopCamera);
    $("#documentCheck").on("change", App.updateVoteReadiness);
    $("#candidateChoices, #candidateGrid").on("change", "input[name=candidate]", function() {
      App.selectedCandidate = Number(this.value);
      $("input[name=candidate]").prop("checked", false);
      $("input[name=candidate][value='" + App.selectedCandidate + "']").prop("checked", true);
      $(".candidate").removeClass("selected");
      $(".candidate[data-id='" + App.selectedCandidate + "']").addClass("selected");
      App.updateVoteReadiness();
    });
    if (!window.ethereum) {
      $("#networkState").text("No wallet");
      App.status("MetaMask was not detected. Install/enable the MetaMask browser extension, then reload.", "error");
      await App.loadContractReadOnly();
      return;
    }
    App.web3Provider = window.ethereum;
    // The bundled legacy Web3.js expects sendAsync; bridge it to MetaMask's EIP-1193 request API.
    if (typeof window.ethereum.sendAsync !== "function") {
      window.ethereum.sendAsync = function(payload, callback) {
        window.ethereum.request({method:payload.method, params:payload.params || []})
          .then(function(result) { callback(null, {id:payload.id, jsonrpc:"2.0", result:result}); })
          .catch(function(error) { callback(error, null); });
      };
    }
    try {
      const accounts = await window.ethereum.request({method:"eth_requestAccounts"});
      App.account = accounts && accounts[0] ? accounts[0] : null;
      App.chainId = await window.ethereum.request({method:"eth_chainId"});
      if (App.chainId !== "0xaa36a7") {
        await App.handleNetwork(true);
        App.chainId = await window.ethereum.request({method:"eth_chainId"});
      } else {
        $("#networkState").text("Sepolia");
      }
      window.ethereum.on("accountsChanged", function(accounts) {
        App.account = accounts && accounts[0] ? accounts[0] : null;
        App.hasVoted = false;
        App.renderWallet();
        App.refresh();
      });
      window.ethereum.on("chainChanged", function(chainId) {
        App.chainId = chainId;
        $("#networkState").text(chainId === "0xaa36a7" ? "Sepolia" : "Wrong network");
        window.location.reload();
      });
      App.renderWallet();
      await App.initContract();
    } catch (err) {
      console.error(err);
      App.status("Wallet connection was not completed. Approve MetaMask and select Sepolia, then reload. Public results may still be available.", "error");
      await App.loadContractReadOnly();
    }
  },
  handleNetwork: async function(allowSwitch) {
    if (App.chainId === "0xaa36a7") {
      $("#networkState").text("Sepolia");
      return true;
    }
    $("#networkState").text("Wrong network");
    if (!allowSwitch) {
      App.status("Please switch MetaMask to Ethereum Sepolia to cast a demo vote.", "error");
      return false;
    }
    try {
      await window.ethereum.request({method:"wallet_switchEthereumChain", params:[{chainId:"0xaa36a7"}]});
      App.chainId = await window.ethereum.request({method:"eth_chainId"});
      $("#networkState").text(App.chainId === "0xaa36a7" ? "Sepolia" : "Wrong network");
      return App.chainId === "0xaa36a7";
    } catch (err) {
      if (err.code === 4902) {
        App.status("Sepolia is not configured in MetaMask. Add the Sepolia test network and retry.", "error");
      } else if (err.code !== 4001) {
        App.status("Could not switch to Sepolia. Change networks in MetaMask and retry.", "error");
      } else {
        App.status("Please select Sepolia in MetaMask before voting.", "error");
      }
      return false;
    }
  },
  initContract: function() {
    return new Promise(function(resolve, reject) {
      $.getJSON("Election.json", function(election) {
        App.contracts.Election = TruffleContract(election);
        App.contracts.Election.setProvider(App.web3Provider);
        App.refresh().then(resolve).catch(reject);
        try {
          App.contracts.Election.deployed().then(function(instance) {
            if (instance.votedEvent) {
              instance.votedEvent({}, {fromBlock:"latest"}).watch(function(err) {
                if (!err) App.refresh();
              });
            }
          });
        } catch (e) { console.warn("Event listener setup failed; manual refresh remains available.", e); }
      }).fail(function(xhr, status, error) {
        reject(new Error("Could not load Election.json: " + error));
      });
    });
  },
  loadContractReadOnly: async function() {
    try {
      App.web3Provider = new Web3.providers.HttpProvider("https://ethereum-sepolia-rpc.publicnode.com");
      await App.initContract();
    } catch (e) {
      console.warn(e);
      $("#candidateGrid").html("<p class='helper'>Unable to load live results. Verify connectivity and contract deployment.</p>");
      App.status("Contract data could not be loaded. Check connectivity and the deployed contract address.", "error");
    }
  },
  renderWallet: function() {
    var connected = !!App.account;
    $("#walletPill").text(connected ? App.account.slice(0,6) + "…" + App.account.slice(-4) : "Wallet not connected");
    $("#walletCheck").prop("checked", connected);
    $("#walletInfo").text("Wallet: " + (connected ? App.account : "Not connected") + " | Network: " + (App.chainId === "0xaa36a7" ? "Sepolia" : "Please select Sepolia") + " | Contract: 0xf664550a77585d52944db0FbD3CDB2148B7777c9");
    App.updateVoteReadiness();
  },
  refresh: async function() {
    if (!App.contracts.Election) return;
    try {
      const instance = await App.contracts.Election.deployed();
      const countBN = await instance.candidatesCount();
      const total = Number(countBN.toString());
      const candidates = [];
      for (let i=1; i<=total; i++) {
        const c = await instance.candidates(i);
        // Some deployed artifacts expose (id,name,voteCount), others (id,name,party,voteCount).
        const hasParty = typeof c[2] === "string";
        const voteIndex = hasParty ? 3 : 2;
        candidates.push({id:Number(c[0].toString()), name:c[1], party:hasParty ? c[2] : (App.parties[i] || {}).party || "Independent", votes:Number(c[voteIndex].toString())});
      }
      App.candidates = candidates;
      App.hasVoted = false;
      if (App.account && App.chainId === "0xaa36a7") {
        try { App.hasVoted = await instance.voters(App.account); } catch(e) { console.warn("Could not read voter status",e); }
      }
      App.renderCandidates();
      $("#totalVotes").text(String(candidates.reduce((sum,c)=>sum+c.votes,0)).padStart(2,"0"));
      if (App.hasVoted) App.status("This wallet has already voted according to the smart contract. A second vote will be rejected.", "success");
      else if (App.account) App.status("Contract data loaded. Complete the demo checklist to enable voting.", "");
      App.updateVoteReadiness();
    } catch (err) {
      console.error(err);
      App.status("Could not read votes from the deployed contract. Verify the network, ABI and deployment address.", "error");
      $("#candidateGrid").html("<p class='helper'>Live contract data is unavailable. No placeholder vote counts are being displayed.</p>");
    }
  },
  renderCandidates: function() {
    const grid = $("#candidateGrid");
    const choices = $("#candidateChoices");
    grid.empty(); choices.empty();
    const total = App.candidates.reduce((s,c)=>s+c.votes,0);
    App.candidates.forEach(function(candidate) {
      const info = App.parties[candidate.id] || {party:candidate.party, color:"#64748b", logo:""};
      const share = total ? Math.round(candidate.votes / total * 100) : 0;
      const card = $("<article class='candidate' data-id='" + candidate.id + "'><div class='candidate-top' style='background:" + info.color + "'></div><div class='candidate-body'><img class='party-logo' alt='' loading='lazy'><h3></h3><div class='party-name'></div><div class='candidate-footer'><div><div class='vote-number'></div><div class='vote-caption'>Votes · " + share + "%</div></div><label class='select-label'><input type='radio' name='candidate' value='" + candidate.id + "'> Select</label></div></div></article>");
      const img = card.find("img");
      if (info.logo) img.attr("src", info.logo).attr("alt", info.short + " party symbol");
      else img.hide();
      img.on("error", function(){ $(this).hide(); });
      card.find("h3").text(candidate.name);
      card.find(".party-name").text(info.party || candidate.party);
      card.find(".vote-number").text(String(candidate.votes).padStart(2,"0"));
      grid.append(card);
      const choice = $("<label class='check'><input type='radio' name='candidate' value='" + candidate.id + "'><div><strong></strong><span></span></div></label>");
      choice.find("strong").text(candidate.name);
      choice.find("span").text(info.party || candidate.party);
      choices.append(choice);
    });
    if (App.selectedCandidate && !App.candidates.some(c=>c.id===App.selectedCandidate)) App.selectedCandidate = null;
    if (App.selectedCandidate) {
      $("input[name=candidate][value='" + App.selectedCandidate + "']").prop("checked",true);
      $(".candidate[data-id='" + App.selectedCandidate + "']").addClass("selected");
    }
  },
  updateVoteReadiness: function() {
    const ok = !!App.account && App.chainId === "0xaa36a7" && $("#documentCheck").is(":checked") && $("#cameraCheck").is(":checked") && App.selectedCandidate && !App.hasVoted;
    $("#voteButton").prop("disabled", !ok);
    $("#voteButton").text(App.hasVoted ? "Vote already recorded" : ok ? "Cast vote via MetaMask" : "Complete prerequisites to vote");
  },
  status: function(message, kind) {
    $("#voteStatus").text(message).removeClass("error success").addClass(kind || "");
  },
  castVote: async function() {
    if (!App.account || App.selectedCandidate == null) return;
    if (!$("#documentCheck").is(":checked") || !$("#cameraCheck").is(":checked")) {
      App.status("Complete the document-readiness acknowledgement and start the camera preview first.", "error"); return;
    }
    const onSepolia = await App.handleNetwork(true);
    if (!onSepolia) return;
    if (App.hasVoted) {
      App.status("This wallet has already voted; the contract permits one vote per wallet.", "error"); return;
    }
    $("#voteButton").prop("disabled",true).text("Waiting for MetaMask…");
    App.status("Confirm the transaction in MetaMask. Your vote is not counted until the transaction is mined.", "");
    try {
      const instance = await App.contracts.Election.deployed();
      const tx = await instance.vote(App.selectedCandidate, {from:App.account});
      App.status("Transaction submitted: " + tx.tx + ". Waiting for confirmation…", "");
      await App.waitForReceipt(tx.tx);
      App.status("Vote transaction confirmed on Sepolia. Refreshing live counts…", "success");
      await App.refresh();
    } catch (err) {
      console.error(err);
      const msg = err && (err.message || err.reason) || "Transaction failed.";
      App.status(msg.toLowerCase().includes("already voted") ? "The contract says this wallet has already voted." : "Vote was not recorded. You may have rejected the MetaMask prompt or the transaction failed. " + msg.slice(0,180), "error");
    } finally { App.updateVoteReadiness(); }
  },
  waitForReceipt: async function(txHash) {
    for (let i=0;i<90;i++) {
      const receipt = await window.ethereum.request({method:"eth_getTransactionReceipt",params:[txHash]});
      if (receipt) {
        if (receipt.status === "0x0") throw new Error("Transaction reverted on-chain.");
        return receipt;
      }
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    throw new Error("Receipt is taking longer than expected. Refresh the page to check the final status.");
  },
  startCamera: async function() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $("#cameraStatus").text("This browser does not support camera access. Use a modern browser on HTTPS or localhost.").addClass("error"); return;
    }
    try {
      App.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
      const video = document.getElementById("cameraVideo");
      video.srcObject = App.stream;
      video.style.display = "block";
      $("#cameraPlaceholder").addClass("hidden");
      $("#cameraCheck").prop("checked",true);
      $("#startCamera").prop("disabled",true);
      $("#stopCamera").prop("disabled",false);
      $("#cameraStatus").text("Camera preview running locally. No identity match is performed and no video is uploaded.").removeClass("error").addClass("success");
      App.updateVoteReadiness();
    } catch(err) {
      $("#cameraStatus").text("Camera access was not granted. Allow camera permission in the browser and retry if appropriate.").removeClass("success").addClass("error");
    }
  },
  stopCamera: function() {
    if (App.stream) App.stream.getTracks().forEach(track=>track.stop());
    App.stream = null;
    const video = document.getElementById("cameraVideo");
    if (!video) return;
    video.srcObject = null;
    video.style.display = "none";
    $("#cameraPlaceholder").removeClass("hidden");
    $("#cameraCheck").prop("checked",false);
    $("#startCamera").prop("disabled",false);
    $("#stopCamera").prop("disabled",true);
    $("#cameraStatus").text("Camera preview stopped. Start it again if you want to continue the demo.").removeClass("success error");
    App.updateVoteReadiness();
  }
};
$(function(){ App.init(); window.addEventListener("beforeunload",App.stopCamera); });