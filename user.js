const express = require('express')
const bodyParser = require('body-parser')
const mysql = require('mysql2')
const session = require('express-session')
const bcrypt = require('bcrypt')

const SALT_ROUNDS = 10;

const app = express()
const sec = 1000
const hour = 60 * 60 * sec
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        // maxAge: 10 * sec
        maxAge: hour
    }
}))

app.use(bodyParser.json())
const port = 3000
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    port: '3306',
    password: 'gkdms~!1357',
    database: 'rolling_db'
})

// 미들웨어: 중간에 껴서 잠깐 검사를 한다.
const loginRequired = function(req, res, next) {
    if(req.session.user) {
        next()
    } else {
        // 원래는 401(인증안됨)을 해야 함
        // 근데 그냥 귀찮아서 440으로 함
	    // 440 => 마소가 쓰는 세션 만료용 에러 코드
        res.status(440).json({ result: "현재 로그인 상태가 아닙니다." })
    }
}

// 1. 로그인리콰이어드
// 2. 롤리콰이어드
// 복잡
// allowed로 허용할 사람들에 대한 권한을 나열한다
// 요청보낸 사람의 권한이 
// 미들웨어아님주의
// 미들웨어생성함수
const roleRequired = function(allowed) {
    // 미들웨어 리턴
    return function(req, res, next) {
        const user = req.session.user
        const roles = user.roles
        let hasRole = false
        for(const role of roles) {
            if(allowed.includes(role)) {
                hasRole = true
                break
            }
        }
        if(hasRole) next()
        else res.status(403).json({ result: "권한이 없습니다." })
    }
}

app.post("/api/users", (req, res) => {
    // 최소한의 보안
    bcrypt.hash(req.body.password, SALT_ROUNDS, function(err, hash) {
        pool.query("INSERT INTO users(email, password, name, createdAt) VALUES(?, ?, ?, now())",
            [req.body.email, hash, req.body.name],
            function(err, rows, fields) { 
                if(err) {
                    res.json({ result: err })
                } else {
                    res.json({ result: "ok" })
                }
            })
    })  
})

// delete는 꼭 login이 된 이후에(loginRequired) 해야 함
app.delete("/api/users/:email", loginRequired, (req, res) => {
    const user = req.session.user
    const email = req.params.email

    // 1. 지우려고 하는 사람이 나인가
    // 2. 지우려고 하는 사람이 관리자인가
    if(user.email === email || user.roles.includes("admin")) {
        pool.query("DELETE FROM users WHERE email=?",
        [email],
        function(err, rows, fields) {
            if(rows.affectedRows === 0) {
                res.status(404).json({ result: "존재하지 않는 사용자입니다." })
            } else {
                res.json({ result: "ok" })
            }
        })
    } else {
        // 401: 인증안됨(로그인안됨) - 자격자체가없음
        // 403: 인증은 했는데 권한이 없다. - 로그인은 했는데 남의 글은 못 지운다
        res.status(403).json({ result: "사용자 삭제 권한이 없습니다." })
    }    
})

// email을 통해 유저 정보를 가져온다
app.get("/api/users/:email", (req, res) => {
    const email = req.params.email
    pool.query("SELECT * FROM users WHERE email = ?",
        [email],
        function(err, rows, fields) {
            if(rows.length === 0) {
                res.status(404).json({ result: "존재하지 않는 사용자입니다." })
            } else {
                res.status(401).json({ result: rows[0] })
            }
        })
})

app.get("/api/users", (req, res) => {
    pool.query("SELECT * FROM users",
    function(err, rows, fields) {
        res.json({ result: rows })
    })
})

app.post("/api/login", (req, res) => {
    // email, password 체크
    const { email, password } = req.body
    pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        function(err, rows, fields) {
            if(rows.length === 0) {
                res.status(401).json({ result: "로그인 실패 (사용자 없음)" })
            } else {
                const user = rows[0]
                // 값 비교
                // 세션아이디라는 키로 정보를 전달한다.
                // 
                bcrypt.compare(password, rows[0].password, function(err, result) {
                    if(result) {
                        req.session.user = {
                            email: user.email,
                            name: user.name,
                            roles: user.roles.split(",")
                        }
                        req.session.save()
                        res.json({ result: "로그인 성공" })
                    } else {
                        res.status(401).json({ result: "로그인 실패 (비밀번호 불일치)" })
                    }
                })
            }
        })
})

app.post("/api/logout", (req, res) => {
    req.session.destroy()// 세션아이디 지워버린다
    res.json({ result: "로그아웃 완료" })
})

// session에 user가 있는지를 검사하고 가져온다
app.get("/api/me", loginRequired, (req, res) => {
    res.json({ result: req.session.user })
})

// roleRequired(["admin"])이 미들웨어가 아니라 미들웨어를 반환해주는 거다
app.get("/api/admin", [loginRequired, roleRequired(["admin"])], (req, res) => {
    res.json("admin")
})

app.get("/api/vip", [loginRequired, roleRequired(["admin", "vip"])], (req, res) => {
    res.json("vip")
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})