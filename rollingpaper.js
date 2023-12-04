const express = require('express')
const bodyParser = require("body-parser")
const mysql = require('mysql2')
const cors = require('cors')

const app = express()
app.use(bodyParser.json())// body로 보낸 데이터를 json으로 해석해서 컴퓨터가 이해하게 된다

const port = 3000
const pool = mysql.createPool({// connection을 여러 개 만들어 쓸 수 있다. (기본 10개)
    user: 'root',
    password: 'gkdms~!1357',
    database: 'rolling_db'
})

app.post("/api/rollingpapers", cors(), (req, res) => {
    // 여기서 게시글 생성과 관련된 작업 진행
    // 원래 created_at으로 해야 함
    // createdAt은 자동으로 만들어지는 것.

    // 리턴값이 있는 게 아니라 콜백함수로 처리됨
    // res.status(400) : 생략 가능. 결과에 영향을 미치지 않는다. 에러가 나도 잘 작동됨
    pool.query(
        "INSERT INTO rollingpaper (title, maker, receiver, created_at) VALUES(?,?,?,now())",
        [req.body.title, req.body.maker, req.body.receiver, req.body.created_at],
        (err, rows, fields) => {
            if ( err ) res.status(400).json({result: err})
            else res.json({result: "ok"})
        })
})

app.get("/api/rollingpapers", cors(), (req, res) => {
    pool.query("SELECT * FROM rollingpaper", (err, rows, fields) => {
        res.json({result: rows})
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
            if ( rows.affectedRows === 0 ) {
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
            if ( rows.affectedRows === 0 ) {
                res.status(404).json({result: null})
            } else {
                // 기존 데이터와 받은 데이터를 머지하기
                delete req.body.id// req.body=> 내가 보낸 데이터
                const modified = Object.assign(rows[0], req.body)// Object.assign: 
                // rows[0]: 첫 번째 데이터, req.body: 내가 보낸 데이터

                pool.query("UPDATE rollingpaper SET maker = ?, receiver = ?, title = ? WHERE id = ?",
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

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})