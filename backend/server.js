require('dotenv').config();
const express = require('express'),
      path = require('path'),
      bodyParser = require('body-parser'),
      morgan = require('morgan'),
      { Pool, Client } = require('pg'),
      { router: userRouter } = require('./users/router'),
      { router: authRouter, localStrategy, jwtStrategy } = require('./auth'),
      app = express(),
      passport = require('passport'),
      models = require('./src/models');
    //   { sequelize } = require('./src/models');

// Connection url
const connectionString = process.env.DATABASE_URL + ' ';
const client = new Client({ connectionString });
client.connect()
.then(() => console.log('db connected'))
.catch(err => console.error(err));

const port = 3001;

// Server Logging
app.post(morgan('common'));

// Set Public Folder
app.use(express.static(path.join(__dirname, 'public')));

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Header config
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
    if(req.method === 'OPTIONS'){
        return res.send(204);
    }
    next();
});

// Set up Routes
app.use('/users', userRouter);
app.use('/auth', authRouter );
const jwtAuth = passport.authenticate('jwt', { session: false });

// Set up passport strategies
passport.use(localStrategy);
passport.use(jwtStrategy);

app.get('/', function(req, res) {
    res.render('index');
})

app.get('/recipes', jwtAuth, function(req, res) {
    console.log(req.user)
    if(!(req.user.id)) {
        res.redirect('/');
    } else {
        const userId = req.user.id;
        console.log(userId)
        client.query('SELECT * FROM recipes WHERE user_id=$1', [userId])
        .then(result => {
            
        })
        // client.query('SELECT * FROM recipes WHERE user_id=$1', [userId], (err, result) => {
        //     if(err) {
        //         console.error(`Error: ${err}`);
        //     }
        //     res.render('recipes', {recipes: result.rows});
        // });
    }
});

// Add Recipe
app.post('/add', function(req, res) {
    client.query('INSERT INTO recipes(name, ingredients, directions, user_id) VALUES($1, $2, $3, $4)', [req.body.name, req.body.ingredients, req.body.directions, req.body.user_id], (err) => {
        if(err) {
            console.error(`Error: ${err}`);
        }        
    })
    return res.redirect('/');
});

// Delete Recipe
app.delete('/delete/:id', function(req, res) {
    client.query("DELETE FROM recipes WHERE id = $1", [req.params.id], (err) => {
        if(err) {
            console.error(`Error: ${err}`);
        }
    });
    return res.sendStatus(200);
})

// Edit Recipe
app.post('/edit', function(req, res) {
    client.query("UPDATE recipes SET name=$1, ingredients=$2, directions=$3 WHERE id = $4", 
    [req.body.name, req.body.ingredients, req.body.directions, req.body.id], (err) => {
        if(err) {
            console.error(`Error: ${err}`);
        }
    });
    return res.redirect('/');
});

// Server

app.listen(port, function() {
    console.log(`App is listening on port: ${port}`);
});

// sequelize.sync().then(() => {
//     app.listen(port, function() {
//         console.log(`App is listening on port: ${port}`);
//     });
// })