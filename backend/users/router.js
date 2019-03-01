'use strict';
require('dotenv').config();
const express = require('express'),
      bodyParser = require('body-parser'),
      router = express.Router(),
      jsonParser = bodyParser.json(),
      { Pool, Client } = require('pg'),
      { User } = require('./models'),
      { localStrategy, jwtStrategy } = require('../auth'),
      passport = require('passport'),
      connectionString = process.env.DATABASE_URL + ' ';

// Use Passport and jwtAuth to authenticate users and protect endpoints
passport.use(localStrategy);
passport.use(jwtStrategy);
const jwtAuth = passport.authenticate('jwt', { session: false });

// Post a new user
router.post('/signup', jsonParser, function(req, res) {
    //Request Validation

    // 1. Establish the required fields
    const requiredFields = ['username', 'password'];

    // 2. Check if any fields are missing from the request, if a field is missing, return an error
    const missingField = requiredFields.find(field => !(field in req.body));

    if(missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'Validation Error',
            message: 'Missing Field',
            location: missingField
        });
    }

    // 3. Validate request data types, all fields should be strings, otherwise return an error
    const stringFields = [...requiredFields];
    const nonStringField = stringFields.find(field => field in req.body && typeof req.body[field] !== 'string');

    if(nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'Validation Error',
            message: 'Incorrect field type: expected string',
            location: nonStringField
        });
    }

    // 4. Fields should be trimmed, otherwise we want to alert the user. The reason is that we don't want users
    // being locked out of their accounts because they accidentally hit the spacebar
    const explicitlyTrimmedFields = ['username', 'password'];
    const nonTrimmedField = explicitlyTrimmedFields.find(field => req.body[field].trim() !== req.body[field]);

    if(nonTrimmedField) {
        return res.status(422).json({
            code: 422,
            reason: 'Validation Error',
            message: 'Cannot start or end with whitespace',
            location: nonTrimmedField
        });
    }

    // 5. Establish the number of characters there can be for each field
    // This app uses bcrypt which only hashes up to 72 characters, so we don't want users putting in more than that
    const sizedFields = {
        username: {
            min: 1
        },
        password: {
            min: 10,
            max: 72
        }
    };

    // 6. Validate the fields are within the above parameters
    console.log(req.body['username']);
    const tooSmallField = Object.keys(sizedFields).find(
        field => 
                'min' in sizedFields[field] &&
                req.body[field].trim().length < sizedFields[field].min
    );
    const tooLargeField = Object.keys(sizedFields).find(
        field => 
                'max' in sizedFields[field] &&
                req.body[field].trim().length > sizedFields[field].max
    );

    if(tooSmallField || tooLargeField) {
        return res.status(422).json({
            code: 422,
            reason: 'Validation Error',
            message: tooSmallField ? `Must be at least ${sizedFields[tooSmallField].min} characters long`
                                   : `Must be at most ${sizedFields[tooLargeField].max} characters long`,
            location: tooSmallField || tooLargeField
        })
    }

    // If the request passes all of the above, then we start validating the request with the database

    // Database validation

    // 1. Store the relevant information from the request body in variables
    const { username, password } = req.body;
    const newUser = new User(username, password);

    // 2. Check if the user already exists
    // Connection url
    const client = new Client({ connectionString });
    client.connect()
    .then(() => {
        // This query returns a result of true if the username exists, otherwise false
        client.query('SELECT EXISTS(SELECT FROM users WHERE username=$1)', [username])
        .then(result => {
            let userExists = result.rows[0].exists;

            if(userExists) {
                // The username exists so report this to the user
                return res.status(422).json({
                    code: 422,
                    reason: 'ValidationError',
                    message: 'Username already taken',
                    location: 'username'
                });
            } else {
                // The username is available so we hash the password
                newUser.hashPassword()
                .then(hashedPassword => {
                    client.query('INSERT INTO users(username, password) VALUES($1, $2)', [username, hashedPassword], (err, result) => {
                        if(err) {
                            console.log(`Error: ${err}`)
                        }
                    });
                    
                    return res.status(201).json(newUser.serialize());
                })
                // there was an error completing the INSERT INTO query
                .catch(err => console.log(err));
            }
        })
        // there was an error completing the SELECT EXISTS query
        .catch(err => console.log(err));
    })
    // there was an error connecting to the database
    .catch(err => {
        console.error(err);
        if(err.reason === 'Validation Error') {
            return res.status(err.code).json(err);
        }
        return res.status(500).json({
            code: 500,
            message: 'Internal Server Error'
        })
    }); 
});

// Change password
router.put('/updatepassword/:id', jwtAuth, function(req, res) {
    if(!( typeof req.body.currentPassword === 'string' && typeof req.body.newPassword === 'string')) {
        const message = "Validation Error. Password must be of type string";
        console.error(message);
        return res.status(422).json({message});
    }

    const currentPassword = req.body.currentPassword,
          newPassword = req.body.newPassword,
          user = new User(null, currentPassword, req.params.id);

    // The user is required to reauthenticate their login at the time of changing their password for security
    const client = new Client({ connectionString });
    client.connect()
    .then(() => {
        client.query('SELECT * FROM users WHERE user_id=$1', [user.id])
        .then(result => {
            // validate the password in the database then update it
            user.password = result.rows[0].password;
            return user.validatePassword(currentPassword)
        })
        .then(passwordIsValid => {
            // user provided valid credentials
            if(passwordIsValid) {
                user.hashPassword(newPassword)
                .then(hashedPassword => {
                    client.query('UPDATE users SET password=$1 WHERE user_id=$2', [hashedPassword, user.id])
                    .then(() => res.status(201).json({ message: 'Password updated successfully' }))
                })
                .catch(err => res.status(422).json({ message: 'Validation Error1' }))
            } 
            // user did not provide valid credentials
            else {
                return res.status(422).json({ message: 'Validation Error2' })
            }
        })
        .catch(err => res.status(422).json({ message: 'Validation Error3' }))
    })
});

module.exports = { router };