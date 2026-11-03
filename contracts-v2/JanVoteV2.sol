// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// JanVote V2 is an educational voting contract. It is NOT suitable for public elections.
interface IEligibilityVerifier {
    /// Must verify a real proof against the election-specific scope.
    /// A mock verifier is acceptable only on a local development chain.
    function verifyProof(bytes calldata proof, bytes32 electionScope) external view returns (bool);
}

contract JanVoteV2 {
    address public immutable owner;
    uint256 public electionCount;
    IEligibilityVerifier public eligibilityVerifier;

    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
        bool exists;
    }

    struct Election {
        string title;
        uint64 startsAt;
        uint64 endsAt;
        bool exists;
        bool cancelled;
        uint256 candidateCount;
        uint256 totalVotes;
        mapping(uint256 => Candidate) candidates;
        mapping(address => bool) registrationRequested;
        mapping(address => bool) registered;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Election) private elections;

    event ElectionCreated(uint256 indexed electionId, string title, uint64 startsAt, uint64 endsAt);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name, string party);
    event RegistrationRequested(uint256 indexed electionId, address indexed voter);
    event VoterApproved(uint256 indexed electionId, address indexed voter);
    event VoteCast(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId, bytes32 receiptId);
    event ElectionCancelled(uint256 indexed electionId);
    event ElectionVerifierChanged(address indexed verifier);

    modifier onlyOwner() {
        require(msg.sender == owner, "JanVote: only admin");
        _;
    }

    modifier electionExists(uint256 electionId) {
        require(elections[electionId].exists, "JanVote: election not found");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setEligibilityVerifier(address verifier) external onlyOwner {
        require(verifier == address(0) || verifier.code.length > 0, "JanVote: verifier must be a contract");
        eligibilityVerifier = IEligibilityVerifier(verifier);
        emit ElectionVerifierChanged(verifier);
    }

    function createElection(
        string calldata title,
        uint64 startsAt,
        uint64 endsAt
    ) external onlyOwner returns (uint256 electionId) {
        require(bytes(title).length > 0, "JanVote: title required");
        require(endsAt > startsAt && endsAt > block.timestamp, "JanVote: invalid election dates");

        electionId = ++electionCount;
        Election storage e = elections[electionId];
        e.title = title;
        e.startsAt = startsAt;
        e.endsAt = endsAt;
        e.exists = true;

        emit ElectionCreated(electionId, title, startsAt, endsAt);
    }

    function addCandidate(
        uint256 electionId,
        string calldata name,
        string calldata party
    ) external onlyOwner electionExists(electionId) returns (uint256 candidateId) {
        Election storage e = elections[electionId];
        require(block.timestamp < e.startsAt, "JanVote: candidate setup closed");
        require(bytes(name).length > 0, "JanVote: candidate name required");

        candidateId = ++e.candidateCount;
        e.candidates[candidateId] = Candidate(candidateId, name, party, 0, true);
        emit CandidateAdded(electionId, candidateId, name, party);
    }

    /// Voter submits a registration request. Admin approval is still required.
    /// If a verifier is configured, a valid proof is required as well.
    function requestRegistration(
        uint256 electionId,
        bytes calldata eligibilityProof
    ) external electionExists(electionId) {
        Election storage e = elections[electionId];
        require(block.timestamp < e.startsAt, "JanVote: registration closed");
        require(!e.registered[msg.sender] && !e.registrationRequested[msg.sender], "JanVote: already registered/requested");

        if (address(eligibilityVerifier) != address(0)) {
            bytes32 scope = keccak256(abi.encode(address(this), block.chainid, electionId));
            require(eligibilityVerifier.verifyProof(eligibilityProof, scope), "JanVote: invalid eligibility proof");
        }

        e.registrationRequested[msg.sender] = true;
        emit RegistrationRequested(electionId, msg.sender);
    }

    function approveVoter(
        uint256 electionId,
        address voter
    ) external onlyOwner electionExists(electionId) {
        Election storage e = elections[electionId];
        require(block.timestamp < e.startsAt, "JanVote: registration closed");
        require(e.registrationRequested[voter], "JanVote: no registration request");
        require(!e.registered[voter], "JanVote: already approved");

        e.registered[voter] = true;
        emit VoterApproved(electionId, voter);
    }

    function vote(
        uint256 electionId,
        uint256 candidateId
    ) external electionExists(electionId) {
        Election storage e = elections[electionId];
        require(!e.cancelled, "JanVote: election cancelled");
        require(block.timestamp >= e.startsAt && block.timestamp <= e.endsAt, "JanVote: election not active");
        require(e.registered[msg.sender], "JanVote: voter not approved");
        require(!e.hasVoted[msg.sender], "JanVote: wallet already voted");
        require(e.candidates[candidateId].exists, "JanVote: invalid candidate");

        e.hasVoted[msg.sender] = true;
        e.candidates[candidateId].voteCount += 1;
        e.totalVotes += 1;

        // Receipt proves transaction inclusion; candidate choice remains visible on this demo chain.
        bytes32 receiptId = keccak256(abi.encode(address(this), block.chainid, electionId, msg.sender, candidateId, block.number));
        emit VoteCast(electionId, msg.sender, candidateId, receiptId);
    }

    function cancelElection(uint256 electionId) external onlyOwner electionExists(electionId) {
        Election storage e = elections[electionId];
        require(block.timestamp < e.startsAt, "JanVote: election already started");
        e.cancelled = true;
        emit ElectionCancelled(electionId);
    }

    function getElection(uint256 electionId)
        external view electionExists(electionId)
        returns (string memory title, uint64 startsAt, uint64 endsAt, bool active, bool cancelled, uint256 candidateCount, uint256 totalVotes)
    {
        Election storage e = elections[electionId];
        active = !e.cancelled && block.timestamp >= e.startsAt && block.timestamp <= e.endsAt;
        return (e.title, e.startsAt, e.endsAt, active, e.cancelled, e.candidateCount, e.totalVotes);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external view electionExists(electionId)
        returns (uint256 id, string memory name, string memory party, uint256 voteCount)
    {
        Candidate storage c = elections[electionId].candidates[candidateId];
        require(c.exists, "JanVote: candidate not found");
        return (c.id, c.name, c.party, c.voteCount);
    }

    function getVoterStatus(uint256 electionId, address voter)
        external view electionExists(electionId)
        returns (bool requested, bool approved, bool voted)
    {
        Election storage e = elections[electionId];
        return (e.registrationRequested[voter], e.registered[voter], e.hasVoted[voter]);
    }
}
