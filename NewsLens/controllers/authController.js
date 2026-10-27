const bcrypt = require('bcrypt');
const User = require('../models/User');

const SALT_ROUNDS = 10;

function showRegister(req, res) {
  res.render('register', { pageTitle: 'Register - NewsLens', error: null });
}

async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.render('register', {
      pageTitle: 'Register - NewsLens',
      error: 'All fields are required.'
    });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.render('register', {
      pageTitle: 'Register - NewsLens',
      error: 'An account with that email already exists.'
    });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, password: passwordHash });

  req.session.user = { id: user._id, name: user.name, email: user.email };
  res.redirect('/');
}

function showLogin(req, res) {
  res.render('login', { pageTitle: 'Log in - NewsLens', error: null });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });

  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  if (!user || !passwordMatches) {
    return res.render('login', {
      pageTitle: 'Log in - NewsLens',
      error: 'Incorrect email or password.'
    });
  }

  req.session.user = { id: user._id, name: user.name, email: user.email };
  res.redirect('/');
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/');
  });
}

module.exports = { showRegister, register, showLogin, login, logout };
