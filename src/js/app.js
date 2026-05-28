App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

  // Party data mapped to candidate IDs
  parties: {
    1: { name: "Bharatiya Janata Party (BJP)", badge: "bjp" },
    2: { name: "Indian National Congress (INC)", badge: "inc" },
    3: { name: "Aam Aadmi Party (AAP)", badge: "aap" },
    4: { name: "All India Trinamool Congress (TMC)", badge: "tmc" }
  },

  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
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

    // Load account data
    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("🔗 Connected Wallet: " + account);
      }
    });

    // Load contract data
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

          // Get party info
          var partyInfo = App.parties[id] || { name: "Independent", badge: "bjp" };

          // Render candidate row with party badge
          var candidateTemplate = "<tr>" +
            "<th>" + id + "</th>" +
            "<td><strong>" + name + "</strong></td>" +
            "<td><span class='party-badge " + partyInfo.badge + "'>" + partyInfo.name + "</span></td>" +
            "<td class='vote-count'>" + voteCount + "</td>" +
            "</tr>";
          candidatesResults.append(candidateTemplate);

          // Render dropdown option
          var candidateOption = "<option value='" + id + "'>" + name + " - " + partyInfo.name + "</option>";
          candidatesSelect.append(candidateOption);
        });
      }

      return electionInstance.voters(App.account);

    }).then(function(hasVoted) {
      if (hasVoted) {
        $('form').hide();
        // Show already voted message
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