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
    1: {party:"Bharatiya Janata Party (BJP)", short:"BJP", color:"#f47721", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Bharatiya_Janata_Party_logo.svg/160px-Bharatiya_Janata_Party_logo.svg.png", leader:"Narendra Modi", leaderPhoto:"https://www.pmindia.gov.in/wp-content/uploads/2025/12/02.jpg"},
    2: {party:"Indian National Congress (INC)", short:"INC", color:"#16834a", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Indian_National_Congress_hand_logo.svg/160px-Indian_National_Congress_hand_logo.svg.png", leader:"Rahul Gandhi", leaderPhoto:"https://commons.wikimedia.org/wiki/Special:FilePath/Rahul_Gandhi.jpg"},
    3: {party:"Aam Aadmi Party (AAP)", short:"AAP", color:"#2846b8", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Aam_Aadmi_Party_logo_%28English%29.svg/160px-Aam_Aadmi_Party_logo_%28English%29.svg.png", leader:"Arvind Kejriwal", leaderPhoto:"https://commons.wikimedia.org/wiki/Special:FilePath/Arvind_Kejriwal.jpg"},
    4: {party:"All India Trinamool Congress (TMC)", short:"TMC", color:"#00a7d8", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/All_India_Trinamool_Congress_logo.svg/160px-All_India_Trinamool_Congress_logo.svg.png", leader:"Mamata Banerjee", leaderPhoto:"https://commons.wikimedia.org/wiki/Special:FilePath/Mamata_Banerjee.jpg"}
  },
  init: async function() {
    App.demoMode = true;
    App.account = "Local demo voter";
    App.chainId = "LOCAL";
    $("#networkState").text("Local demo");
    $(".top-meta").append("<span class='pill' style='background:#174c3a'>LOCAL DEMO · NOT ON BLOCKCHAIN</span>");
    $("#walletPill").text("Local demo");
    $("#walletInfo").text("Local demo mode. No wallet connected and no blockchain transaction will be sent.");
    $("#voteButton").on("click", App.castVote);
    $("#cameraStatus").text("Camera is not required in local demo mode. No identity check is performed.");
    $("#cameraCheck, #documentCheck").prop("checked", true);
    $("#startCamera, #stopCamera").prop("disabled", true);
    $("#candidateChoices, #candidateGrid").on("change", "input[name=candidate]", function() {
      App.selectedCandidate = Number(this.value);
      $("input[name=candidate]").prop("checked", false);
      $("input[name=candidate][value='" + App.selectedCandidate + "']").prop("checked", true);
      $(".candidate").removeClass("selected");
      $(".candidate[data-id='" + App.selectedCandidate + "']").addClass("selected");
      App.updateVoteReadiness();
    });
    App.candidates = [
      {id:1,name:"Narendra Modi",party:"Bharatiya Janata Party (BJP)",votes:0},
      {id:2,name:"Rahul Gandhi",party:"Indian National Congress (INC)",votes:0},
      {id:3,name:"Arvind Kejriwal",party:"Aam Aadmi Party (AAP)",votes:0},
      {id:4,name:"Mamata Banerjee",party:"All India Trinamool Congress (TMC)",votes:0}
    ];
    App.loadDemoState();
    App.renderCandidates();
    $("#totalVotes").text(String(App.candidates.reduce((sum,c)=>sum+c.votes,0)).padStart(2,"0"));
    App.renderWallet();
    $("#voteStatus").text("Local demo is ready. Votes stay in this browser and are not submitted to Ethereum.");
    $("#totalVotes").after(" <button type='button' id='resetDemoVotes' class='btn btn-outline' style='margin-left:10px;padding:7px 10px;font-size:12px'>Reset demo votes to 0</button>");
    $("#resetDemoVotes").on("click", function() {
      if (!window.confirm("Reset votes stored in this browser? Blockchain records are unchanged.")) return;
      localStorage.removeItem("janvote-local-demo-v1");
      App.loadDemoState(); App.renderCandidates();
      $("#totalVotes").text("00");
      App.updateVoteReadiness();
      App.status("Local demo votes reset to 0. Blockchain records were not changed.", "success");
    });
    App.updateVoteReadiness();
  },
  loadDemoState: function() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("janvote-local-demo-v1") || "{}"); } catch(e) {}
    App.candidates.forEach(function(c) { c.votes = Number((saved.counts || {})[c.id] || 0); });
    App.hasVoted = !!saved.hasVoted;
  },
  saveDemoState: function() {
    var counts = {};
    App.candidates.forEach(function(c) { counts[c.id] = c.votes; });
    localStorage.setItem("janvote-local-demo-v1", JSON.stringify({counts:counts,hasVoted:App.hasVoted}));
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
          App.contracts.Election.at("0xf664550a77585d52944db0FbD3CDB2148B7777c9").then(function(instance) {
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
    if (App.demoMode) {
      $("#walletPill").text("Local demo");
      $("#walletCheck").prop("checked", true);
      $("#walletInfo").text("Local demo mode · No wallet connected · No blockchain transaction");
      App.updateVoteReadiness();
      return;
    }
    var connected = !!App.account;
    $("#walletPill").text(connected ? App.account.slice(0,6) + "…" + App.account.slice(-4) : "Wallet not connected");
    $("#walletCheck").prop("checked", connected);
    $("#walletInfo").text("Wallet: " + (connected ? App.account : "Not connected") + " | Network: " + (App.chainId === "0xaa36a7" ? "Sepolia" : "Please select Sepolia") + " | Contract: 0xf664550a77585d52944db0FbD3CDB2148B7777c9");
    App.updateVoteReadiness();
  },
  refresh: async function() {
    if (!App.demoMode) return;
    App.loadDemoState(); App.renderCandidates();
    $("#totalVotes").text(String(App.candidates.reduce((sum,c)=>sum+c.votes,0)).padStart(2,"0"));
    App.updateVoteReadiness();
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
    const ok = App.demoMode && !!App.selectedCandidate && !App.hasVoted;
    $("#voteButton").prop("disabled", !ok);
    $("#voteButton").text(App.hasVoted ? "Demo vote recorded" : ok ? "Cast local demo vote" : "Select a candidate");
  },
  status: function(message, kind) {
    $("#voteStatus").text(message).removeClass("error success").addClass(kind || "");
  },
  castVote: async function() {
    if (!App.demoMode || App.selectedCandidate == null) return;
    if (App.hasVoted) { App.status("This browser has already cast its local demo vote. Reset to try again.", "error"); return; }
    var candidate = App.candidates.find(function(c){ return c.id === App.selectedCandidate; });
    if (!candidate) return;
    candidate.votes += 1; App.hasVoted = true; App.saveDemoState();
    App.renderCandidates();
    $("#totalVotes").text(String(App.candidates.reduce((sum,c)=>sum+c.votes,0)).padStart(2,"0"));
    App.status("Local demo vote recorded for " + candidate.name + ". This is not an Ethereum transaction.", "success");
    App.updateVoteReadiness();
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