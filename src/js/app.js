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
    1: {party:"Bharatiya Janata Party (BJP)", short:"BJP", color:"#f47721", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Bharatiya_Janata_Party_logo.svg/160px-Bharatiya_Janata_Party_logo.svg.png", leader:"Narendra Modi", leaderPhoto:"https://commons.wikimedia.org/wiki/Special:FilePath/Narendra_Modi_official_portrait.jpg"},
    2: {party:"Indian National Congress (INC)", short:"INC", color:"#16834a", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Indian_National_Congress_hand_logo.svg/160px-Indian_National_Congress_hand_logo.svg.png", leader:"Rahul Gandhi", leaderPhoto:"https://commons.wikimedia.org/wiki/Special:FilePath/Rahul_Gandhi.jpg"},
    3: {party:"Aam Aadmi Party (AAP)", short:"AAP", color:"#2846b8", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Aam_Aadmi_Party_logo_%28English%29.svg/160px-Aam_Aadmi_Party_logo_%28English%29.svg.png", leader:"Arvind Kejriwal", leaderPhoto:"https://commons.wikimedia.org/wiki/Special:FilePath/Arvind_Kejriwal.jpg"},
    4: {party:"All India Trinamool Congress (TMC)", short:"TMC", color:"#00a7d8", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/All_India_Trinamool_Congress_logo.svg/160px-All_India_Trinamool_Congress_logo.svg.png", leader:"Mamata Banerjee", leaderPhoto:"https://commons.wikimedia.org/wiki/Special:FilePath/Mamata_Banerjee.jpg"}
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
      const card = $("<article class='candidate' data-id='" + candidate.id + "'><div class='candidate-top' style='background:" + info.color + "'></div><div class='candidate-body'><img class='party-logo' alt='' loading='lazy'><div class='leader-row'><img class='leader-photo' alt='' loading='lazy'><div class='leader-copy'><h3></h3><div class='party-name'></div><div class='leader-name'></div></div></div><div class='candidate-footer'><div><div class='vote-number'></div><div class='vote-caption'>Votes · " + share + "%</div></div><label class='select-label'><input type='radio' name='candidate' value='" + candidate.id + "'> Select</label></div></div></article>");
      const img = card.find("img");
      if (info.logo) img.attr("src", info.logo).attr("alt", info.short + " party symbol");
      else img.hide();
      img.on("error", function(){ $(this).hide(); });
      const leaderImg = card.find(".leader-photo");
      if (info.leaderPhoto) leaderImg.attr("src", info.leaderPhoto).attr("alt", (info.leader || candidate.name) + " photo");
      else leaderImg.hide();
      leaderImg.on("error", function(){ $(this).hide(); });
      card.find("h3").text(candidate.name);
      card.find(".party-name").text(info.party || candidate.party);
      card.find(".leader-name").text(info.leader ? "Party leader: " + info.leader : "");
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

/* State-wise explorer is informational only. It never changes the live contract or vote counts. */
var StateElectionExplorer = {
  cycles: {
    "Goa": ["2027", "40 Assembly seats", "Expected cycle: early 2027"],
    "Uttarakhand": ["2027", "70 Assembly seats", "Expected cycle: early 2027"],
    "Punjab": ["2027", "117 Assembly seats", "Expected cycle: early 2027"],
    "Manipur": ["2027", "60 Assembly seats", "Expected cycle: early 2027"],
    "Uttar Pradesh": ["2027", "403 Assembly seats", "Expected cycle: early 2027"],
    "Himachal Pradesh": ["2027", "68 Assembly seats", "Expected cycle: late 2027"],
    "Gujarat": ["2027", "182 Assembly seats", "Expected cycle: late 2027"],
    "Tripura": ["2028", "60 Assembly seats", "Expected cycle: early 2028"],
    "Meghalaya": ["2028", "60 Assembly seats", "Expected cycle: early 2028"],
    "Nagaland": ["2028", "60 Assembly seats", "Expected cycle: early 2028"],
    "Karnataka": ["2028", "224 Assembly seats", "Expected cycle: mid 2028"],
    "Mizoram": ["2028", "40 Assembly seats", "Expected cycle: late 2028"],
    "Chhattisgarh": ["2028", "90 Assembly seats", "Expected cycle: late 2028"],
    "Madhya Pradesh": ["2028", "230 Assembly seats", "Expected cycle: late 2028"],
    "Rajasthan": ["2028", "200 Assembly seats", "Expected cycle: late 2028"],
    "Telangana": ["2028", "119 Assembly seats", "Expected cycle: late 2028"],
    "Arunachal Pradesh": ["2029", "60 Assembly seats", "Expected cycle: spring 2029"],
    "Sikkim": ["2029", "32 Assembly seats", "Expected cycle: spring 2029"],
    "Andhra Pradesh": ["2029", "175 Assembly seats", "Expected cycle: mid 2029"],
    "Odisha": ["2029", "147 Assembly seats", "Expected cycle: mid 2029"],
    "Jammu & Kashmir": ["2029*", "90 Assembly seats", "Indicative cycle: 2029; verify official notifications"],
    "Haryana": ["2029", "90 Assembly seats", "Expected cycle: late 2029"],
    "Jharkhand": ["2029", "81 Assembly seats", "Expected cycle: late 2029"],
    "Maharashtra": ["2029", "288 Assembly seats", "Expected cycle: late 2029"],
    "Delhi": ["2030", "70 Assembly seats", "Expected cycle: early 2030"],
    "Bihar": ["2030", "243 Assembly seats", "Expected cycle: late 2030"],
    "Tamil Nadu": ["2031", "234 Assembly seats", "Expected cycle: spring 2031"],
    "Kerala": ["2031", "140 Assembly seats", "Expected cycle: spring 2031"],
    "West Bengal": ["2031", "294 Assembly seats", "Expected cycle: spring 2031"],
    "Assam": ["2031", "126 Assembly seats", "Expected cycle: spring 2031"],
    "Puducherry": ["2031", "30 Assembly seats", "Expected cycle: spring 2031"]
  },
  render: function() {
    var select = document.getElementById("stateElectionSelect");
    var target = document.getElementById("stateElectionDetails");
    if (!select || !target) return;
    var state = select.value;
    var data = this.cycles[state];
    if (!data) return;
    target.innerHTML = "";
    var cycle = document.createElement("div");
    cycle.className = "state-detail-card";
    cycle.innerHTML = "<span class='state-tag'>Indicative cycle</span><small>STATE / UNION TERRITORY</small><strong></strong><p></p>";
    cycle.querySelector("strong").textContent = state;
    cycle.querySelector("p").textContent = data[2] + ". Exact polling dates are announced by the Election Commission.";
    var seats = document.createElement("div");
    seats.className = "state-detail-card";
    seats.innerHTML = "<small>LEGISLATIVE ASSEMBLY</small><strong></strong><p class='state-disclaimer'>This explorer is informational. It is not a live state election and does not submit votes.</p>";
    seats.querySelector("strong").textContent = data[1];
    target.appendChild(cycle);
    target.appendChild(seats);
  },
  init: function() {
    var select = document.getElementById("stateElectionSelect");
    if (!select) return;
    select.addEventListener("change", this.render.bind(this));
    this.render();
  }
};

$(function(){ App.init(); StateElectionExplorer.init(); window.addEventListener("beforeunload",App.stopCamera); });