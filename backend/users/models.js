'use strict';
const bcrypt = require('bcryptjs');

function User(username, password, id) {
    this.username = username;
    this.password = password;
    this.id = id;

    this.serialize = function() {
        return {
            username: this.username || '',
            id: this.id || ''
        }
    }

    this.hashPassword = function(newPassword) {
        return bcrypt.hash(newPassword || this.password, 10);
    }
    
    this.validatePassword = function(password) {
        return bcrypt.compare(password, this.password)
    }
}

module.exports = { User }