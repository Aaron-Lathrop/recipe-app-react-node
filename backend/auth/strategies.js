'use strict';
require('dotenv').config();
const { Strategy: LocalStrategy } = require('passport-local'),
      { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt'),
      { Pool, Client } = require('pg'),
      connectionString = process.env.DATABASE_URL + ' ',
      { User } = require('../users/models');

const localStrategy = new LocalStrategy((username, password, callback) => {
  // 1. Connect to database and attempt to find user
  let user;

  const client = new Client({ connectionString });
  client.connect()
  .then(() => {
    client.query('SELECT * FROM users WHERE username=$1', [username])
    .then(_user => {
      // First we check that we found something from the query
      if(_user.rows[0]) {
        const { username: foundUsername, password: foundPassword, user_id: foundId } = _user.rows[0];
        user = new User( foundUsername, foundPassword, foundId );
        if(!user) {
          const err = {
            reason: 'Login Error',
            message: 'Incorrect username or password'
          };
          return callback(err, false);
        } else {
            return user.validatePassword(password)
        } 
      }
    })
    // 2. Validate the user's credentials and pass on user information if successful
    .then(passwordIsValid => {
      if(!(passwordIsValid)) {
        const err = {
          reason: 'Login Error',
          message: 'Incorrect username or password'
        };
        return callback(null, false, err);
      }
      return callback(null, user);
    })
    // there was an error during the SELECT * query
    .catch(err => console.error(err))
  })
  .catch(err => {
    if (err.reason === 'Login Error') {
      return callback(null, false, err);
    }
    return callback(err, false);
  });
});

const jwtStrategy = new JwtStrategy(
  {
    secretOrKey: process.env.JWT_SECRET,
    // Look for the JWT as a Bearer auth header
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Bearer'),
    // Only allow HS256 tokens - the same as the ones we issue
    algorithms: ['HS256']
  },
  (payload, done) => {
    done(null, payload.user);
  }
);

module.exports = { localStrategy, jwtStrategy };