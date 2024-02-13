import { Pool } from "pg"


export const connection = new Pool({
  application_name: Bun.env.application_name,
  host: Bun.env.host,
  port: 5432,
  database: Bun.env.database,
  user: Bun.env.user,
  password: Bun.env.password
})

//TODO: Talvez trabalhar o poll aqui

//const x = await connection.query("Select * from account")
//console.log(x.rows)