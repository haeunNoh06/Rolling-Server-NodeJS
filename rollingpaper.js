const express = require('express')
const bodyParser = require("body-parser")
const mysql = require('mysql2')
const cors = require('cors')
const session = require('express-session')
const bcrypt = require('bcrypt');//1
const SALT_ROUNDS = 10// 2의 10승 반복

const app = express()
app.use(cors())
app.use(bodyParser.json())// body로 보낸 데이터를 json으로 해석해서 컴퓨터가 이해하게 된다

const port = 3000
const pool = mysql.createPool({// connection을 여러 개 만들어 쓸 수 있다.(기본10개)
    host: 'localhost',
    user: 'root',
    port: '3306',
    password: 'gkdms~!1357',
    database: 'rolling_db'
})

const sec = 1000
const hour = 60 * 60 * sec
// session 관련 설정 (=만료시간)
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        // maxAge: 10 * sec
        maxAge: hour
    }
}))

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

app.post("/api/rollingpapers", cors(), (req, res) => {
    // 여기서 게시글 생성과 관련된 작업 진행
    // 원래 created_at으로 해야 함
    // createdAt은 자동으로 만들어지는 것.

    // 리턴값이 있는 게 아니라 콜백함수로 처리됨
    // res.status(400) : 생략 가능. 결과에 영향을 미치지 않는다. 에러가 나도 잘 작동됨
    pool.query(
        "INSERT INTO rollingpaper (title, sender, receiver, created_at) VALUES(?,?,?,now())",
        [req.body.title, req.body.sender, req.body.receiver, req.body.created_at],
        (err, rows, fields) => {
            if ( err ) res.status(400).json({result: err})
            else res.json({result: "ok"})
        })
})

app.get("/api/rollingpapers", cors(), (req, res) => {
    pool.query("SELECT * FROM rollingpaper", (err, rows, fields) => {
        res.json({result: rows});
        //res.sendFile('127.0.0:5502/main.html');// 파일로 보내기
    })
})

app.get("/api/rollingpapers/:id", cors(),  (req, res) => {
    const id = req.params.id
    pool.query("SELECT * FROM rollingpaper WHERE id = ?", [id], (err, rows, fields) => {
        if ( rows.length === 0 ) res.send ({result: null})
        else res.json({ result: rows[0] })
    })
})

app.delete("/api/rollingpapers/:id", cors(), (req, res) => {
    const id = req.params.id
    pool.query("DELETE FROM rollingpaper WHERE id = ?",
        [id], 
        function (err, rows, fields) {
            // 실제로 영향 받은(지워진) 행이 없으면
            if ( !rows.affectedRows ) {
                res.status(404).json({result: null})
            } else {
                res.json({ result: "ok"})
            }
        }
    )
})

app.patch("/api/rollingpapers/:id", cors(), (req, res) => {
    const id = req.params.id
    pool.query(
        "SELECT * FROM rollingpaper WHERE id = ?",
        [id],
        function(err, rows, fields) {
            if ( !rows.affectedRows ) {
                res.status(404).json({result: null})
            } else {
                // 기존 데이터와 받은 데이터를 머지하기
                delete req.body.id// req.body=> 내가 보낸 데이터
                const modified = Object.assign(rows[0], req.body)// Object.assign: 
                // rows[0]: 첫 번째 데이터, req.body: 내가 보낸 데이터

                pool.query("UPDATE rollingpaper SET sender = ?, receiver = ?, title = ? WHERE id = ?",
                    [modified.title, modified.maker, modified.title, id],
                    function(err, rows, fields) {
                        if ( err) {
                            res.status(400).json({result: err})
                        } else {
                            res.json({result: "ok"})
                        }
                    }
                )
            }
        }
    )
})


/* paper */
app.post("/api/papers", (req, res) => {
    // 여기서 게시글 생성과 관련된 작업 진행
    // 원래 created_at으로 해야 함
    // createdAt은 자동으로 만들어지는 것.

    // 리턴값이 있는 게 아니라 콜백함수로 처리됨
    // res.status(400) : 생략 가능. 결과에 영향을 미치지 않는다. 에러가 나도 잘 작동됨
    pool.query(
        "INSERT INTO paper (paper_id, content, writer, font) VALUES(?,?,?,?)",
        [req.body.paper_id, req.body.content, req.body.writer, req.body.font],
        (err, rows, fields) => {
            if ( err ) res.status(400).json({result: err})
            else res.json({result: "ok"})
        })
})

app.get("/api/papers", (req, res) => {
    pool.query("SELECT * FROM paper", (err, rows, fields) => {
        res.json({result: rows})
    })
})

// 롤링페이퍼와 편지의 아이디가 같다면 
app.get("/api/papers/:id",  (req, res) => {
    const id = req.params.id
    pool.query("SELECT * FROM paper P INNER JOIN rollingpaper R ON P.paper_id = R.id WHERE id = ?", [id], (err, rows, fields) => {
        if ( rows.length === 0 ) res.send ({result: null})
        else res.json({ result: rows[0] })
    })
})

app.delete("/api/papers/:id", (req, res) => {
    const id = req.params.id
    pool.query("DELETE FROM paper WHERE id = ?",
        [id], 
        function (err, rows, fields) {
            // 실제로 영향 받은(지워진) 행이 없으면
            if ( rows.affectedRows === 0 ) {
                res.status(404).json({result: null})
            } else {
                res.json({ result: "ok"})
            }
        }
    )
})

app.patch("/api/papers/:id", (req, res) => {
    const id = req.params.id
    pool.query(
        "SELECT * FROM paper WHERE id = ?",
        [id],
        function(err, rows, fields) {
            if ( rows.affectedRows === 0 ) {
                res.status(404).json({result: null})
            } else {
                // 기존 데이터와 받은 데이터를 머지하기
                delete req.body.id// req.body=> 내가 보낸 데이터
                const modified = Object.assign(rows[0], req.body)// Object.assign: 
                // rows[0]: 첫 번째 데이터, req.body: 내가 보낸 데이터

                pool.query("UPDATE paper SET content = ?, writer = ?, font = ? WHERE id = ?",
                    [modified.content, modified.writer, modified.font, id],
                    function(err, rows, fields) {
                        if ( err) {
                            res.status(400).json({result: err})
                        } else {
                            res.json({result: "ok"})
                        }
                    }
                )
            }
        }
    )
})


/* user */
app.post("/api/users", (req, res) => {
    // 최소한의 보안
    bcrypt.hash(req.body.password, SALT_ROUNDS, function(err, hash) {
        pool.query("INSERT INTO users(name, email, password, created_at) VALUES(?, ?, ?, now())",
            [req.body.name, req.body.email, hash],
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
                            name: user.name
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