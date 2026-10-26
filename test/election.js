const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IndianElection", function () {
  let election;
  let admin;
  let voter1;
  let voter2;

  async function expectRevert(promise, expectedMessage) {
    try {
      await promise;
      throw new Error("Expected transaction to revert, but it succeeded.");
    } catch (error) {
      if (error.message === "Expected transaction to revert, but it succeeded.") throw error;
      expect(error.message).to.include(expectedMessage);
    }
  }

  beforeEach(async function () {
    [admin, voter1, voter2] = await ethers.getSigners();
    const Election = await ethers.getContractFactory("IndianElection");
    election = await Election.deploy();
    await election.deployed();
  });

  it("initializes four candidates with zero votes", async function () {
    expect((await election.candidatesCount()).toNumber()).to.equal(4);

    const expected = [
      ["Narendra Modi", "Bharatiya Janata Party (BJP)"],
      ["Rahul Gandhi", "Indian National Congress (INC)"],
      ["Arvind Kejriwal", "Aam Aadmi Party (AAP)"],
      ["Mamata Banerjee", "All India Trinamool Congress (TMC)"]
    ];

    for (let i = 0; i < expected.length; i++) {
      const candidate = await election.candidates(i + 1);
      expect(candidate.id.toNumber()).to.equal(i + 1);
      expect(candidate.name).to.equal(expected[i][0]);
      expect(candidate.party).to.equal(expected[i][1]);
      expect(candidate.voteCount.toNumber()).to.equal(0);
    }
  });

  it("increments the chosen candidate count and emits the vote event", async function () {
    const tx = await election.connect(voter1).vote(1);
    const receipt = await tx.wait();
    expect(receipt.events.some((event) =>
      event.event === "votedEvent" && event.args._candidateId.toNumber() === 1
    )).to.equal(true);

    expect((await election.candidates(1)).voteCount.toNumber()).to.equal(1);
    expect(await election.voters(voter1.address)).to.equal(true);
  });

  it("rejects a second vote from the same wallet without changing totals", async function () {
    await election.connect(voter1).vote(1);

    await expectRevert(
      election.connect(voter1).vote(2),
      "You have already voted."
    );

    expect((await election.candidates(1)).voteCount.toNumber()).to.equal(1);
    expect((await election.candidates(2)).voteCount.toNumber()).to.equal(0);
  });

  it("rejects candidate IDs outside the valid range", async function () {
    await expectRevert(election.connect(voter1).vote(0), "Invalid candidate.");
    await expectRevert(election.connect(voter1).vote(5), "Invalid candidate.");
    expect(await election.voters(voter1.address)).to.equal(false);
  });

  it("allows different wallets to vote and persists the combined count", async function () {
    await election.connect(voter1).vote(1);
    await election.connect(voter2).vote(1);

    expect((await election.candidates(1)).voteCount.toNumber()).to.equal(2);
    expect(await election.voters(voter1.address)).to.equal(true);
    expect(await election.voters(voter2.address)).to.equal(true);
  });

  it("allows only the administrator to end the election", async function () {
    await expectRevert(
      election.connect(voter1).endElection(),
      "Only admin can end election."
    );

    await election.connect(admin).endElection();
    expect(await election.electionActive()).to.equal(false);
  });

  it("rejects votes after the election ends", async function () {
    await election.connect(admin).endElection();

    await expectRevert(
      election.connect(voter1).vote(1),
      "Election has ended."
    );
    expect((await election.candidates(1)).voteCount.toNumber()).to.equal(0);
  });

  it("allows the winner to be read only after the election ends", async function () {
    await election.connect(voter1).vote(2);
    await expectRevert(election.getWinner(), "Election is still active.");

    await election.connect(admin).endElection();
    const winner = await election.getWinner();
    expect(winner.winnerName).to.equal("Rahul Gandhi");
    expect(winner.winnerParty).to.equal("Indian National Congress (INC)");
    expect(winner.winnerVotes.toNumber()).to.equal(1);
  });
});
