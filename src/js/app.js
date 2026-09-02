App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,
  rendered: false,
 
  parties: {
    1: { name: "Bharatiya Janata Party (BJP)", badge: "bjp" },
    2: { name: "Indian National Congress (INC)", badge: "inc" },
    3: { name: "Aam Aadmi Party (AAP)", badge: "aap" },
    4: { name: "All India Trinamool Congress (TMC)", badge: "tmc" }
  },
 
  init: function() {
    return App.initWeb3();
  },
 
  initWeb3: async function() {
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
 
      // Shim: bundled Web3.js is v0.19.0, which calls provider.sendAsync().
      // Modern MetaMask only implements request() (EIP-1193), so without this
      // shim every web3.eth.* / TruffleContract call silently never resolves,
      // which is why the UI gets stuck on "Connecting wallet...".
      if (typeof window.ethereum.sendAsync !== 'function') {
        window.ethereum.sendAsync = function(payload, callback) {
          window.ethereum.request({ method: payload.method, params: payload.params })
            .then(function(result) {
              callback(null, { id: payload.id, jsonrpc: '2.0', result: result });
            })
            .catch(function(error) {
              callback(error, null);
            });
        };
      }
 
      web3 = new Web3(window.ethereum);
 
      try {
        // Force MetaMask's account picker to open every time, instead of
        // silently reusing whatever account was approved on a previous visit.
        // Without this, switching the active account in MetaMask has no
        // effect on this site until you manually disconnect it first.
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }]
          });
        } catch (permError) {
          console.warn('Permission request skipped/denied', permError);
        }
 
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        // Capture the account directly here instead of relying on
        // web3.eth.getCoinbase() later, which modern MetaMask may not support.
        if (accounts && accounts.length > 0) {
          App.account = accounts[0];
          $("#accountAddress").html("🔗 Connected Wallet: " + App.account);
        }
 
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }]
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.infura.io/v3/ad16fbeb600f47d18c5fa87c2dfd371f'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }]
            });
          }
        }
 
        // Keep App.account in sync if the user switches accounts in MetaMask
        window.ethereum.on('accountsChanged', function(newAccounts) {
          App.account = newAccounts[0] || '0x0';
          $("#accountAddress").html("🔗 Connected Wallet: " + App.account);
          App.rendered = false;
          App.render();
        });
 
      } catch (error) {
        console.error('User denied account access', error);
        $("#accountAddress").html("⚠️ Wallet not connected — please approve the MetaMask request and refresh.");
      }
    } else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },
 
  initContract: function() {
    $.getJSON("Election.json", function(election) {
      App.contracts.Election = TruffleContract(election);
      App.contracts.Election.setProvider(App.web3Provider);
      App.listenForEvents();
      return App.render();
    });
  },
 
  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      instance.votedEvent({}, {
        fromBlock: 'latest',
        toBlock: 'latest'
      }).watch(function(error, event) {
        console.log("Vote event triggered", event);
        App.rendered = false;
        App.render();
      });
    });
  },
 
  render: function() {
    if (App.rendered) return;
    App.rendered = true;
 
    var electionInstance;
    var loader = $("#loader");
    var content = $("#content");
 
    loader.show();
    content.hide();
 
    // Account is already set in initWeb3 via eth_requestAccounts, so no
    // getCoinbase() call is needed here.
 
    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
 
      var candidatesResults = $("#candidatesResults");
      candidatesResults.empty();
 
      var candidatesSelect = $("#candidatesSelect");
      candidatesSelect.empty();
 
      var total = candidatesCount.toNumber();
      var promises = [];
 
      for (var i = 1; i <= total; i++) {
        promises.push(electionInstance.candidates(i));
      }
 
      return Promise.all(promises).then(function(allCandidates) {
        var totalVotes = 0;
 
        allCandidates.forEach(function(candidate) {
          var id = candidate[0].toNumber();
          var name = candidate[1];
          var voteCount = candidate[2].toNumber();
          totalVotes += voteCount;
 
          var partyInfo = App.parties[id] || { name: "Independent", badge: "bjp" };
 
          var candidateTemplate = "<tr>" +
            "<th>" + id + "</th>" +
            "<td><strong>" + name + "</strong></td>" +
            "<td><span class='party-badge " + partyInfo.badge + "'>" + partyInfo.name + "</span></td>" +
            "<td class='vote-count'>" + voteCount + "</td>" +
            "</tr>";
          candidatesResults.append(candidateTemplate);
 
          var candidateOption = "<option value='" + id + "'>" + name + " - " + partyInfo.name + "</option>";
          candidatesSelect.append(candidateOption);
        });
 
        $("#totalVotes").text(totalVotes);
 
        return electionInstance.voters(App.account);
      });
 
    }).then(function(hasVoted) {
      if (hasVoted) {
        $('form').hide();
        $(".already-voted-msg").remove();
        $("#candidatesSelect").after(
          "<div class='already-voted-msg' style='background:#d4edda; color:#155724; padding:12px; border-radius:8px; margin-top:10px; text-align:center;'>" +
          "✅ You have already cast your vote. Thank you for participating!" +
          "</div>"
        );
      } else {
        $('form').show();
        $(".already-voted-msg").remove();
      }
      loader.hide();
      content.show();
    }).catch(function(error) {
      console.warn(error);
      App.rendered = false;
      loader.hide();
      content.show();
    });
  },
 
  castVote: function() {
    var candidateId = $("#candidatesSelect").val();
    App.contracts.Election.deployed().then(function(instance) {
      return instance.vote(candidateId, { from: App.account });
    }).then(function(result) {
      $("#content").hide();
      $("#loader").show();
      $("#loader p").html("⏳ Recording your vote on the blockchain...");
    }).catch(function(err) {
      console.error(err);
      alert("❌ Transaction failed. You may have already voted or rejected the MetaMask request.");
    });
  }
};
 
$(function() {
  $(window).load(function() {
    App.init();
  });
});
 