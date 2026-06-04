'use strict';
const express = require("express");
const prisma = require("./utils/prismaClient");
const bcrypt = require("bcrypt");
const session = require("express-session");
const requireLogin = require("./middleware/requireLogin");

const app = express();

app.set('view engine', 'pug');
app.set('views', './views');

app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: "dcg-secret-key",
  resave: false,
  saveUninitialized: false
}));

app.get('/', requireLogin, async (req, res) => {

  const matches = await prisma.match.findMany({
    where: {
      userId: req.session.user.id
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const deckStats = {};

  for (const match of matches) {

    const deckId = match.myDeckId;

    if (!deckStats[deckId]) {
      deckStats[deckId] = {
        deckId,
        totalMatches: 0,
        winCount: 0
      };
    }

    deckStats[deckId].totalMatches++;

    if (match.isWin) {
      deckStats[deckId].winCount++;
    }
  }

  let favoriteDeck = null;

  for (const stat of Object.values(deckStats)) {

    if (
      !favoriteDeck ||
      stat.totalMatches > favoriteDeck.totalMatches
    ) {
      favoriteDeck = stat;
    }
  }

  if (favoriteDeck) {

    const deck = await prisma.deck.findUnique({
      where: {
        id: favoriteDeck.deckId
      }
    });

    favoriteDeck.name = deck.name;

    favoriteDeck.winRate =
      Math.round(
        favoriteDeck.winCount
        /
        favoriteDeck.totalMatches
        * 100
      );
  }

  const totalMatches = matches.length;

  const winCount = matches.filter(
    match => match.isWin
  ).length;

  const winRate =
    totalMatches === 0
      ? 0
      : Math.round(
          winCount / totalMatches * 100
        );

    const recentMatches = matches.slice(0, 5);

  res.render('home', {
    user: req.session.user,
    matches,
    totalMatches,
    winCount,
    winRate,
    recentMatches,
    favoriteDeck
  });
});

app.get('/auth/login', (req, res) => {
  res.render('auth/login', {
    error: null
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('ログアウトに失敗しました');
    }

    res.redirect('auth/login');
  });
});

app.get('/decks', requireLogin, async (req, res) => {
  const decks = await prisma.deck.findMany({
    where: {
      userId: req.session.user.id
    },
    orderBy: {
      name: 'asc'
    }
  });

  res.render('decks/list', {
    user: req.session.user,
    decks
  });
});

app.get('/decks/:id/edit', requireLogin, async (req, res) => {

  const deckId = Number(req.params.id);

  const deck = await prisma.deck.findFirst({
    where: {
      id: deckId,
      userId: req.session.user.id
    }
  });

  if (!deck) {
    return res.redirect('/decks');
  }

  res.render('decks/edit', {
    user: req.session.user,
    deck
  });
});

app.post('/decks/:id/edit', requireLogin, async (req, res) => {

  const deckId = Number(req.params.id);
  const { name } = req.body;

  await prisma.deck.update({
    where: {
      id: deckId
    },
    data: {
      name
    }
  });

  res.redirect('/decks');
});

app.get('/matches/new', requireLogin, async (req, res) => {
  const decks = await prisma.deck.findMany({
    where: {
      userId: req.session.user.id
    },
    orderBy: {
      name: 'asc'
    }
  });

  res.render('matches/create', {
    user: req.session.user,
    decks
  });
});

app.get('/matches', requireLogin, async (req, res) => {

  const decks = await prisma.deck.findMany({
    where: {
      userId: req.session.user.id
    },
    orderBy: {
      name: 'asc'
    }
  });

  const {
    myDeckId,
    isWin,
    playOrder,
    enemyDeckName
  } = req.query;

  const where = {
    userId: req.session.user.id
  };

  if (myDeckId) {
    where.myDeckId = Number(myDeckId);
  }

  if (isWin === 'true' || isWin === 'false') {
    where.isWin = isWin === 'true';
  }

  if (playOrder) {
    where.playOrder = playOrder;
  }

  if (enemyDeckName) {
    where.enemyDeckName = {
      contains: enemyDeckName
    };
  }

  const matches = await prisma.match.findMany({
    where,
    include: {
      myDeck: true
    },
    orderBy: [
      {
        createdAt: 'desc'
      },
      {
        id: 'desc'
      }
    ]
  });

  res.render('matches/list', {
    user: req.session.user,
    matches,
    decks,
    filters: {
      myDeckId,
      isWin,
      playOrder,
      enemyDeckName
    }
  });
});

app.get('/matches/:id/edit', requireLogin, async (req, res) => {

  const matchId = Number(req.params.id);

  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      userId: req.session.user.id
    }
  });

  if (!match) {
    return res.redirect('/matches');
  }

  const decks = await prisma.deck.findMany({
    where: {
      userId: req.session.user.id
    }
  });

  res.render('matches/edit', {
    user: req.session.user,
    match,
    decks
  });
});

app.post('/matches/:id/edit', requireLogin, async (req, res) => {

  const matchId = Number(req.params.id);

  const {
    myDeckId,
    enemyDeckName,
    isWin,
    playOrder,
    memo
  } = req.body;

  await prisma.match.update({
    where: {
      id: matchId
    },
    data: {
      myDeckId: Number(myDeckId),
      enemyDeckName,
      isWin: isWin === "true",
      playOrder,
      memo
    }
  });

  console.log({
    myDeckId,
    enemyDeckName,
    isWin,
    playOrder,
    memo
  });

  res.redirect('/matches');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user) {
    return res.render('auth/login', {
      error: 'ユーザー名またはパスワードが違います'
    });
  }

  const isMatch = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!isMatch) {
    return res.render('auth/login', {
      error: 'ユーザー名またはパスワードが違います'
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username
  };

  res.redirect('/');
});

app.post('/decks', requireLogin, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.redirect('/decks');
  }

  await prisma.deck.create({
    data: {
      name,
      userId: req.session.user.id
    }
  });

  res.redirect('/decks');
});

app.post('/matches/new', requireLogin, async (req, res) => {
  const {
    myDeckId,
    enemyDeckName,
    isWin,
    playOrder,
    memo
  } = req.body;

  await prisma.match.create({
    data: {
      userId: req.session.user.id,
      myDeckId: Number(myDeckId),
      enemyDeckName,
      isWin: isWin === 'true',
      playOrder,
      memo: memo || null
    }
  });

  res.redirect('/matches');
});

app.post('/decks/:id/delete', requireLogin, async (req, res) => {
  const deckId = Number(req.params.id);

  await prisma.deck.delete({
    where: {
      id: deckId,
      userId: req.session.user.id
    }
  });

  res.redirect('/decks');
});

app.post('/matches/:id/delete', requireLogin, async (req, res) => {
  const matchId = Number(req.params.id);

  await prisma.match.delete({
    where: {
      id: matchId,
      userId: req.session.user.id
    }
  });

  res.redirect('/matches');
});

app.get('/analysis', requireLogin, async (req, res) => {
  const mode = req.query.mode || 'ALL';

  const where = {
    userId: req.session.user.id
  };

  if (mode === 'FIRST') {
    where.playOrder = 'FIRST';
  }

  if (mode === 'SECOND') {
    where.playOrder = 'SECOND';
  }

  const allMatches = await prisma.match.findMany({
    where: {
      userId: req.session.user.id
    },
    include: {
      myDeck: true
    }
  });

  const deckCountMap = {};

  for (const match of allMatches) {

    const deckId = match.myDeck.id;

    if (!deckCountMap[deckId]) {
      deckCountMap[deckId] = 0;
    }

    deckCountMap[deckId]++;
  }

  const deckOrder = Object.entries(deckCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([deckId]) => Number(deckId));

  const matches = await prisma.match.findMany({
    where,
    include: {
      myDeck: true
    }
  });

  const statsMap = {};

  for (const match of matches) {

    const deckId = match.myDeck.id;

    if (!statsMap[deckId]) {
      statsMap[deckId] = {
        deckId,
        deckName: match.myDeck.name,
        totalMatches: 0,
        winCount: 0
      };
    }

    statsMap[deckId].totalMatches++;

    if (match.isWin) {
      statsMap[deckId].winCount++;
    }
  }

  const stats = Object.values(statsMap).map(stat => ({
    ...stat,
    winRate:
      stat.totalMatches === 0
        ? 0
        : Math.round(
            stat.winCount / stat.totalMatches * 100
          )
  }));

  stats.sort((a, b) =>
    deckOrder.indexOf(a.deckId) -
    deckOrder.indexOf(b.deckId)
  );

  res.render('analysis/index', {
    mode,
    stats,
    chartLabels: stats.map(s => s.deckName),
    chartWinRates: stats.map(s => s.winRate)
  });
});

app.get('/analysis/decks/:id', requireLogin, async (req, res) => {

  const deckId = Number(req.params.id);

  const mode = req.query.mode || 'ALL';

  const deck = await prisma.deck.findFirst({
    where: {
      id: deckId,
      userId: req.session.user.id
    }
  });

  if (!deck) {
      return res.redirect('/analysis');
  }

  const allMatches = await prisma.match.findMany({
    where: {
      userId: req.session.user.id,
      myDeckId: deckId
    }
  });

  const enemyCountMap = {};

  for (const match of allMatches) {

    const enemy = match.enemyDeckName;

    if (!enemyCountMap[enemy]) {
      enemyCountMap[enemy] = 0;
    }

    enemyCountMap[enemy]++;
  }

  const enemyOrder = Object.entries(enemyCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([enemy]) => enemy);

  const where = {
    userId: req.session.user.id,
    myDeckId: deckId
  };

  if (mode === 'FIRST') {
    where.playOrder = 'FIRST';
  }

  if (mode === 'SECOND') {
    where.playOrder = 'SECOND';
  }

  const matches = await prisma.match.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    }
  });

  const statsMap = {};

for (const match of matches) {

  const enemy = match.enemyDeckName;

  if (!statsMap[enemy]) {
    statsMap[enemy] = {
      enemyDeckName: enemy,
      totalMatches: 0,
      winCount: 0
    };
  }

  statsMap[enemy].totalMatches++;

  if (match.isWin) {
    statsMap[enemy].winCount++;
  }
}

const stats = Object.values(statsMap).map(stat => ({
  ...stat,
  winRate:
    stat.totalMatches === 0
      ? 0
      : Math.round(
          stat.winCount / stat.totalMatches * 100
        )
}));

stats.sort(
  (a, b) =>
    enemyOrder.indexOf(a.enemyDeckName)
    -
    enemyOrder.indexOf(b.enemyDeckName)
);

  res.render('analysis/deck', {
    user: req.session.user,
    deck,
    mode,
    stats,
    matches,
    chartLabels: stats.map(s => s.enemyDeckName),
    chartWinRates: stats.map(s => s.winRate)
  });
});

app.listen(8000, () => {
  console.log("Server started");
});