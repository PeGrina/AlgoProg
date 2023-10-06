require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const db = require('./db/db');
const katex = require('katex');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const logged = cookies => {
    if (cookies.access_token) {
        return jwt.verify(cookies.access_token, process.env["SECRET_KEY"]);
    } else {
        return false;
    }
};

nav_list = [
  { link: "/", name: "Главная" }
];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/files');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use((req, res, next) => {
    req.nav_list = Array.from(nav_list);
    if (logged(req.cookies)) {
        req.nav_list.push({ link: '/admin', name: 'Админ панель' });
        req.nav_list.push({ link: '/logout', name: 'Выйти из системы' });
    } else {
        req.nav_list.push({ link: '/login', name: 'Войти в систему' });
    }
    next()
});

app.get('/', function(req, res) {
    let sql = 'SELECT * FROM articles';
    db.all(sql, [], (err, result) => {
        if (err) {
            console.log(err);
        }
        res.render('index', { title: process.env["NAME"], nav_list: req.nav_list, articles: result });
    });
});

app.post('/upload', (req, res, next) => {
    if (logged(req.cookies))
        next();
    else
        res.redirect('/');
});

app.post('/upload', upload.single('file'), (req, res) => {
    res.send('Файл был успешно выложен');
});

app.get('/upload', (req, res) => {
    if (!logged(req.cookies)) {
        res.redirect('/');
        return;
    }
    res.render('upload', { title: process.env["NAME"], nav_list: req.nav_list });
})

app.get('/article/create', (req, res) => {
    let sql = 'INSERT INTO articles (name, article_text, authors, show, date, subarticles) VALUES (?,?,?,?,?,?)';
    let params = ["", "", "", "0", "28.09.2023", ""];
    db.run(sql, params, function (err, result) {
        if (err) {
            console.log(err);
            res.status(500).send('Статья не была создана (произошла какая-то ошибка)');
        } else {
            res.redirect('/article/edit/' + this.lastID);
        }
    });
});

app.get('/article/edit/:id', (req, res) => {
    if (!logged(req.cookies)) {
        res.redirect('/article/' + req.params["id"]);
        return;
    }
    let sql = "SELECT * FROM articles WHERE id = ?"
    let params = [req.params["id"]];
    db.get(sql, params, (err, row) => {
        if (err) {
            console.log(err);
            res.status(404).render('404', { title: process.env["NAME"], nav_list: req.nav_list });
        } else {
            res.render('article_edit', { title: process.env["NAME"], nav_list: req.nav_list, article: row});
        }
    });
});

app.post('/article/edit/:id', (req, res) => {
    if (!logged(req.cookies)) {
        res.redirect('/article/' + req.params["id"]);
        return;
    }
    let show = "0";
    if (req.body.article_show !== undefined)
        show = "1";
    let params = [req.body.article_name, req.body.article_text, req.body.article_author, show, req.body.article_subarticles, req.params["id"]];
    let sql = 'UPDATE articles SET name = ?, article_text = ?, authors = ?, show = ?, subarticles = ? WHERE id = ?';
    db.run(sql, params, (err, row) => {
        if (err) {
            console.log(err);
            res.status(500).send('Статья не была отредактирована (произошла какая-то ошибка)');
        } else {
            res.redirect('/article/edit/' + req.params["id"]);
        }
    });
});

const edit_latex = s => {
    let
        t = '',
        c = '',
        bal = 0;
    for (let i = 0; i < s.length; ++i) {
        if (bal) {
            if (s[i] === '$') {
                t += katex.renderToString(c);
                c = '';
                bal = 0;
            } else {
                c += s[i];
            }
        } else {
            if (s[i] === '$') {
                bal = 1;
            } else {
                if (s[i] === '\r')
                    continue;
                if (s[i] === '\n')
                    t += '\n';
                else
                    t += s[i];
            }
        }
    }
    return t;
}

app.get('/logout', (req, res) => {
    if (!logged(req.cookies)) {
        res.redirect('/login');
    } else {
        res
            .clearCookie('access_token')
            .redirect('/login');
    }
});

app.get('/login', (req, res) => {
    if (logged(req.cookies)) {
        res.redirect('/admin');
    } else {
        res.render("login", {title: process.env["NAME"], nav_list: req.nav_list});
    }
});

app.post('/login', (req, res) => {
    let sql = 'SELECT * FROM users WHERE name = ?';
    let params = [req.body.login];
    db.get(sql, params, (err, row) => {
        if (err || row === undefined) {
            console.log(err);
            res.status(400).render("login", { title: process.env["NAME"], nav_list: req.nav_list, error: "Пользователь не был найден"});
        } else {
            bcrypt
                .compare(req.body.password, row.password)
                .then(result => {
                    if (result) {
                        const token = jwt.sign(row, process.env["SECRET_KEY"]);
                        res
                            .cookie("access_token", token, {
                                httpOnly: true,
                                secure: process.env.NODE_ENV === "production",
                            })
                            .redirect('/admin');
                    } else {
                        res.status(400).render("login", { title: process.env["NAME"], nav_list: req.nav_list, error: "Неправильный пароль"});
                    }
                })
                .catch(err => {
                    console.log(err);
                    res.status(400).render("login", { title: process.env["NAME"], nav_list: req.nav_list, error: "Что-то пошло не так "});
                });
        }
    });
});

app.get('/admin', (req, res) => {
    if (!logged(req.cookies)) {
        res.redirect('/login');
    } else {
        let sql = 'SELECT * FROM articles';
        db.all(sql, [], (err, result) => {
            if (err)
                console.log(err);
            res.render('admin', {title: process.env["NAME"], nav_list: req.nav_list, articles: result});
        });
    }
});

app.get('/article/:id', (req, res) => {
    let sql = "SELECT * FROM articles WHERE id = ?"
    let params = [req.params["id"]];
    db.get(sql, params, (err, row) => {
        if (err || (row.show === "0" && !logged(req.cookies))) {
            res.status(404).render('404', { title: process.env["NAME"], nav_list: req.nav_list });
        } else {
            let text = row.article_text;
            row.article_text = edit_latex(text);
            res.render('article', { title: process.env["NAME"], nav_list: req.nav_list, article: row});
        }
    });
});



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
