import { Elysia, t } from 'elysia';
import { connection } from '../database/database'

export const clientsController = (app: Elysia) =>
  app.group('/clientes', (app: Elysia) =>
    app.get(':id', async (handler: Elysia.Handler) => {

      try {

        const { id } = handler.params;

        if (isNaN(id))
          return { message: 'Id precisa ser um número inteiro' }

        const cliente = await connection.query("SELECT limite, saldo FROM cliente WHERE id = $1", [id])

        if (cliente.rowCount == 0) {
          handler.set.status = 404
          return { message: "Cliente não encontrado" }
        }

        return {
          id: id,
          limite: cliente.rows[0].limite,
          saldo: cliente.rows[0].saldo
        };

      } catch (error) {
        handler.set.status = 500;
        return {
          message: 'Unable to delete resource!',
          erroMessage: error.message,
          status: 500,
        };
      }
    })
      .post(':id/transacoes', async (handler: Elysia.Handler) => {

        const clientDb = await connection.connect()
        try {

          const { id } = handler.params;
          const { valor, tipo, descricao } = handler.body;

          if (isNaN(id)) {
            handler.set.status = 422
            return { message: 'Id precisa ser um número inteiro' }
          }

          if (valor == null || tipo == null || descricao == null) {
            handler.set.status = 422
            return { message: 'valor, tipo e descricao são campos obrigatorios' }
          }

          if (tipo != "c" && tipo != "d") {
            handler.set.status = 422
            return { message: 'tipo precisa ser "c" ou "d"' }
          }

          if (!Number.isInteger(valor) || valor < 0) {
            handler.set.status = 422
            return { message: 'valor precisa ser um número inteiro e positivo' }
          }

          if (typeof descricao != "string" || descricao.length < 1 || descricao.length > 10) {
            handler.set.status = 422
            return { message: 'descricao tem que ser uma string com ate 10 caracteres' }
          }

          //TODO: Verificar junto da CTE talvez
          const cliente = await connection.query("SELECT limite, saldo FROM cliente WHERE id = $1", [id])

          if (cliente.rowCount == 0) {
            handler.set.status = 404
            return { message: "Cliente não encontrado" }
          }

          const valorCrebito = tipo === "d" ? valor * -1 : valor
          //Aplicar regra de transação
          await clientDb.query('BEGIN');
          await clientDb.query(`
          UPDATE cliente SET saldo = saldo + $1 WHERE id = $2`,
            [valorCrebito, id]);

          const saldoResult = await clientDb.query(`
            SELECT saldo, limite
            FROM cliente
            WHERE id = $1`,
            [id]);

          const saldoAtual = saldoResult.rows[0].saldo;
          const limite = saldoResult.rows[0].limite;

          if (saldoAtual + limite < 0) {
            await clientDb.query('ROLLBACK');
            handler.set.status = 422;
            return {
              message: "Saldo insuficiente!"
            }
          } else {
            await clientDb.query(`
            INSERT INTO transacoes_cliente (cliente_id, valor, tipo, descricao)
            VALUES ($1, $2, $3, $4)`,
              [id, valor, tipo, descricao]);
            await clientDb.query('COMMIT'); // Commita a transação

            return {
              limite: limite,
              saldo: saldoAtual
            }
          }

        } catch (error) {
          handler.set.status = 500;
          await clientDb.query('ROLLBACK')
          return {
            message: 'Unable to delete resource!',
            erroMessage: error.message,
            status: 500,
          };
        } finally {
          clientDb.release()
        }
      })
      .get(':id/extrato', async (handler: Elysia.Handler) => {
        try {
          const { id } = handler.params;

          if (isNaN(id)) {
            handler.set.status = 422
            return { message: 'Id precisa ser um número inteiro' }
          }

          //TODO: Verificar junto da CTE talvez
          const cliente = await connection.query("SELECT limite, saldo FROM cliente WHERE id = $1", [id])

          if (cliente.rowCount == 0) {
            handler.set.status = 404
            return { message: "Cliente não encontrado" }
          }

          const saldoAtual = cliente.rows[0].saldo;
          const limite = cliente.rows[0].limite;
          const currentDate = new Date();

          const transacoes = await connection.query(`
          SELECT valor, tipo, descricao, realizada_em FROM transacoes_cliente WHERE cliente_id = $1 ORDER BY realizada_em DESC LIMIT 10`
            , [id])

          return {
            "saldo": {
              "total": saldoAtual,
              "data_extrato": currentDate.toISOString(),
              "limite": limite
            },
            "ultimas_transacoes": transacoes.rows
          }

        } catch (error) {
          handler.set.status = 500;
          return {
            message: 'Unable to delete resource!',
            erroMessage: error.message,
            status: 500,
          };
        }
      }
      )
  );
