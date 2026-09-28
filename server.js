// Ponte EVO Facial 40 -> Ponto EVO Integrado (Base44)
// Escuta o protocolo WebSocket do relógio (Secullum, RFC6455) e
// repassa cada batida para o webhook receivePunch do sistema.
import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = Number(process.env.PORT || 7788);
const WEBHOOK_URL = 'https://evo-servidoralves.base44.app/functions/receivePunch';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Data/hora no formato que o aparelho espera: "2026-09-28 08:31:00"
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Ponte EVO Facial 40 ativa');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[evo] equipamento conectado');

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const cmd = msg.cmd;

    // 1) Registro do equipamento — confirmar para ele começar a enviar logs
    if (cmd === 'reg') {
      ws.send(JSON.stringify({ ret: 'reg', result: true, cloudtime: now(), nosenduser: true }));
      console.log('[evo] registrado:', msg.sn, '| modelo:', msg.devinfo?.modelname);
      return;
    }

    // 2) Batidas de ponto — repassar cada uma para o sistema
    if (cmd === 'sendlog') {
      const records = Array.isArray(msg.record) ? msg.record : [];
      for (const r of records) {
        const cpf = String(r.enrollid ?? '').replace(/\D/g, '');
        if (!cpf) continue;
        try {
          const resp = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ cpf, timestamp: r.time, secret: WEBHOOK_SECRET })
          });
          console.log('[evo] batida cpf', cpf, r.time, resp.ok ? '-> registrada' : '-> ERRO ' + resp.status);
        } catch (e) {
          console.error('[evo] falha ao enviar batida:', e.message);
        }
      }
      ws.send(JSON.stringify({
        ret: 'sendlog', result: true, count: msg.count, logindex: msg.logindex,
        cloudtime: now(), access: 1
      }));
      return;
    }

    // Outros comandos (getuserlist, etc.): confirma recebimento sem erro
    ws.send(JSON.stringify({ ret: cmd, result: true, cloudtime: now() }));
  });

  ws.on('close', () => console.log('[evo] equipamento desconectou'));
  ws.on('error', () => {});
});

server.listen(PORT, () => console.log('Ponte EVO escutando na porta', PORT));