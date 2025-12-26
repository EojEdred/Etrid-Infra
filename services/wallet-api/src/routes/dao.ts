import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get DAOs for a user
router.get('/', (req: Request, res: Response) => {
  const address = req.query.address as string || '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

  // Get DAOs where user is a member
  const memberDaoIds = db.daoMembers
    .filter(m => m.address === address)
    .map(m => m.daoId);

  const daos = db.daos.filter(dao => memberDaoIds.includes(dao.id));

  const formattedDaos = daos.map(dao => {
    const member = db.daoMembers.find(m => m.daoId === dao.id && m.address === address);
    return {
      id: dao.id,
      name: dao.name,
      description: dao.description,
      governanceToken: dao.governanceToken,
      treasury: dao.treasury,
      members: dao.members,
      votingThreshold: dao.votingThreshold,
      proposalDeposit: dao.proposalDeposit,
      votingPeriod: dao.votingPeriod,
      userVotingPower: member?.votingPower || 0
    };
  });

  res.json({ daos: formattedDaos });
});

// Get proposals for a DAO
router.get('/:daoId/proposals', (req: Request, res: Response) => {
  const status = req.query.status as string;

  let proposals = db.proposals.filter(p => p.daoId === req.params.daoId);

  if (status) {
    proposals = proposals.filter(p => p.status === status);
  }

  proposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const formattedProposals = proposals.map(p => {
    const totalVotes = p.votesFor + p.votesAgainst + p.votesAbstain;
    const blocksRemaining = Math.max(0, p.endBlock - 1000100);

    return {
      id: p.id,
      daoId: p.daoId,
      title: p.title,
      description: p.description,
      proposer: p.proposer,
      status: p.status,
      votesFor: p.votesFor,
      votesAgainst: p.votesAgainst,
      votesAbstain: p.votesAbstain,
      totalVotes,
      threshold: p.threshold,
      hasReachedQuorum: totalVotes >= p.threshold,
      votesForPercentage: totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0,
      votesAgainstPercentage: totalVotes > 0 ? (p.votesAgainst / totalVotes) * 100 : 0,
      blocksRemaining,
      timeRemaining: formatTimeRemaining(blocksRemaining * 6),
      startBlock: p.startBlock,
      endBlock: p.endBlock,
      createdAt: p.createdAt
    };
  });

  res.json({ proposals: formattedProposals });
});

// Create a proposal
router.post('/:daoId/proposals', (req: Request, res: Response) => {
  const { title, description, proposer } = req.body;
  const daoId = req.params.daoId;

  const dao = db.daos.find(d => d.id === daoId);
  if (!dao) return res.status(404).json({ error: 'DAO not found' });

  const currentBlock = 1000100;
  const endBlock = currentBlock + Math.floor(dao.votingPeriod / 6);

  const newProposal = {
    id: `prop_${uuidv4().slice(0, 8)}`,
    daoId,
    title,
    description,
    proposer: proposer || '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    status: 'active',
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    threshold: dao.votingThreshold,
    startBlock: currentBlock,
    endBlock,
    createdAt: new Date().toISOString()
  };

  db.proposals.push(newProposal);
  res.status(201).json(newProposal);
});

// Vote on a proposal
router.post('/proposals/:proposalId/vote', (req: Request, res: Response) => {
  const { voter, voteType, votingPower } = req.body;
  const proposalId = req.params.proposalId;

  const proposal = db.proposals.find(p => p.id === proposalId);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

  if (proposal.status !== 'active') {
    return res.status(400).json({ error: 'Proposal is not active' });
  }

  // Check if already voted
  const existingVote = db.votes.find(v => v.proposalId === proposalId && v.voter === voter);
  if (existingVote) {
    return res.status(400).json({ error: 'Already voted on this proposal' });
  }

  // Create vote
  const vote = {
    id: `vote_${uuidv4().slice(0, 8)}`,
    proposalId,
    voter,
    voteType,
    votingPower: Number(votingPower),
    createdAt: new Date().toISOString()
  };

  db.votes.push(vote);

  // Update proposal vote counts
  if (voteType === 'for') {
    proposal.votesFor += vote.votingPower;
  } else if (voteType === 'against') {
    proposal.votesAgainst += vote.votingPower;
  } else {
    proposal.votesAbstain += vote.votingPower;
  }

  res.status(201).json(vote);
});

// Get user's vote on a proposal
router.get('/proposals/:proposalId/votes/:voter', (req: Request, res: Response) => {
  const vote = db.votes.find(
    v => v.proposalId === req.params.proposalId && v.voter === req.params.voter
  );

  if (!vote) {
    return res.status(404).json({ error: 'Vote not found' });
  }

  res.json(vote);
});

// Get DAO member info
router.get('/:daoId/members/:address', (req: Request, res: Response) => {
  const member = db.daoMembers.find(
    m => m.daoId === req.params.daoId && m.address === req.params.address
  );

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  res.json(member);
});

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ended';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default router;
