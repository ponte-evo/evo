// Ponte EVO Facial 40 -> Ponto EVO Integrado (Base44)
import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = Number(process.env.PORT || 7788);
const WEBHOOK_URL = 'https://evo-servidoralves.base44.app/functions/receivePunch';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

const now = () =>
  new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

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

    if (cmd === 'reg') {
      ws.sn = String(msg.sn || '');
      ws.send(JSON.stringify({ ret: 'reg', result: true, cloudtime: now(), nosenduser: true }));
      console.log('[evo] registrado:', ws.sn, '| modelo:', msg.devinfo?.modelname);
      return;
    }

    if (cmd === 'sendlog') {
      const records = Array.isArray(msg.record) ? msg.record : [];
      for (const r of records) {
        const cpf = String(r.enrollid ?? '').replace(/\D/g, '');
        if (!cpf) continue;
        try {
          const resp = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ cpf, timestamp: r.time, sn: ws.sn, secret: WEBHOOK_SECRET })
          });
          console.log('[evo] batida cpf', cpf, r.time, ws.sn ? '| maquina ' + ws.sn : '', resp.ok ? '-> registrada' : '-> ERRO ' + resp.status);
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

    ws.send(JSON.stringify({ ret: cmd, result: true, cloudtime: now() }));
  });

  ws.on('close', () => console.log('[evo] equipamento desconectou'));
  ws.on('error', () => {});
});

server.listen(PORT, () => console.log('Ponte EVO escutando na porta', PORT));
