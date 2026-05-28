pragma solidity >=0.4.20;

contract IndianElection {

    // Model a Candidate
    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    // Store accounts that have voted
    mapping(address => bool) public voters;

    // Store Candidates
    mapping(uint => Candidate) public candidates;

    // Store Candidates Count
    uint public candidatesCount;

    // Election name
    string public electionName = "Indian General Election 2026";

    // Admin address
    address public admin;

    // Election status
    bool public electionActive;

    // voted event
    event votedEvent (
        uint indexed _candidateId
    );

    constructor() public {
        admin = msg.sender;
        electionActive = true;
        addCandidate("Narendra Modi", "Bharatiya Janata Party (BJP)");
        addCandidate("Rahul Gandhi", "Indian National Congress (INC)");
        addCandidate("Arvind Kejriwal", "Aam Aadmi Party (AAP)");
        addCandidate("Mamata Banerjee", "All India Trinamool Congress (TMC)");
    }

    function addCandidate(string memory _name, string memory _party) private {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(
            candidatesCount,
            _name,
            _party,
            0
        );
    }

    function vote(uint _candidateId) public {
        // require election to be active
        require(electionActive, "Election has ended.");

        // require that they haven't voted before
        require(!voters[msg.sender], "You have already voted.");

        // require a valid candidate
        require(
            _candidateId > 0 && _candidateId <= candidatesCount,
            "Invalid candidate."
        );

        // record that voter has voted
        voters[msg.sender] = true;

        // update candidate vote count
        candidates[_candidateId].voteCount++;

        // trigger voted event
        emit votedEvent(_candidateId);
    }

    // Admin can end the election
    function endElection() public {
        require(msg.sender == admin, "Only admin can end election.");
        electionActive = false;
    }

    // Get winner (only after election ends)
    function getWinner() public view returns (string memory winnerName, string memory winnerParty, uint winnerVotes) {
        require(!electionActive, "Election is still active.");
        uint highestVotes = 0;
        uint winnerId = 0;
        for (uint i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > highestVotes) {
                highestVotes = candidates[i].voteCount;
                winnerId = i;
            }
        }
        winnerName = candidates[winnerId].name;
        winnerParty = candidates[winnerId].party;
        winnerVotes = candidates[winnerId].voteCount;
    }
}