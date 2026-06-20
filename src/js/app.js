App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

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
      web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
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
      } catch (error) {
        console.error('User denied account access', error);
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
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        console.log("Vote event triggered", event);
        App.render();
      });
    });
  },

  render: function() {
    var electionInstance;
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("🔗 Connected Wallet: " + account);
      }
    });

    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {

      var candidatesResults = $("#candidatesResults");
      candidatesResults.empty();

      var candidatesSelect = $("#candidatesSelect");
      candidatesSelect.empty();

      for (var i = 1; i <= candidatesCount; i++) {
        electionInstance.candidates(i).then(function(candidate) {
          var id = candidate[0];
          var name = candidate[1];
          var voteCount = candidate[2];

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
      }

      return electionInstance.voters(App.account);

    }).then(function(hasVoted) {
      if (hasVoted) {
        $('form').hide();
        $("#candidatesSelect").after(
          "<div style='background:#d4edda; color:#155724; padding:12px; border-radius:8px; margin-top:10px; text-align:center;'>" +
          "✅ You have already cast your vote. Thank you for participating!" +
          "</div>"
        );
      }
      loader.hide();
      content.show();
    }).catch(function(error) {
      console.warn(error);
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
