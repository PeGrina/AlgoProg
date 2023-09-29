const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error(err.message)
        throw err
    }else{
        console.log('Connected to the SQLite database.')
        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name text, 
            email text UNIQUE, 
            password text, 
            CONSTRAINT email_unique UNIQUE (email)
        )`, (err) => {
                if (err) {
                    // Table already created
                } else {
                    // Table just created, creating some rows
                    const users = [
                        ["apavl", "a.pavlov123123@gmail.com", "123123"]
                    ];
                    for (let user of users) {
                        bcrypt
                            .genSalt(10)
                            .then(salt => {
                                return bcrypt.hash(user[2], salt);
                            })
                            .then(hash => {
                                user[2] = hash;
                                db.run('INSERT INTO users (name, email, password) VALUES (?,?,?)', user);
                            });
                    }
                }
        });
        db.run(`CREATE TABLE articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name text,
            article_text text, 
            authors text,
            show text,
            date text,
            subarticles text
        )`, (err) => {});
    }
});

module.exports = db;