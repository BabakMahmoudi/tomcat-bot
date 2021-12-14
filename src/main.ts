import tomcat from '@gostarehnegar/tomcat'

import { BotProcess } from './BotProcess';
tomcat.config.data.redis.publicUrl = "redis://localhost:6379";
tomcat.config.messaging.transports.websocket.diabled = true;
const bus = new tomcat.Infrastructure.Bus.RedisBus();

const host = tomcat.hosts.getHostBuilder("mohsen").buildWebHost('express')
const Processes: BotProcess[] = []
const app = host.expressApp
const bots = []
const PORT = 8001;

bus.subscribe("bots/*/controls/*", (m) => {
    const contents = m.content<{ id: string, port: number }>()
    const curbot = bots.find(x => x.id == contents.id)
    if (curbot) {
        curbot.port = contents.port
    } else {
        bots.push(contents)
    }
})
app.get('/start', async (req, res) => {
    const conf = req.body
    const bot = new BotProcess("../tomcat-bots-talib/build/main/Arshia/index.js");
    Processes.push(bot)
    bots.push({ id: bot.id })
    res.end()
    await bot.Start(conf);
})
app.post('/start', async (req, res) => {
    const conf = req.body
    const bot = new BotProcess("../tomcat-bots-talib/build/main/Arshia/index.js");
    Processes.push(bot)
    bots.push({ id: bot.id })
    res.end()
    await bot.Start(conf);
})
app.get("/Processes", (req, res) => {
    (req);
    res.json(Processes)
    res.end()
})
app.get("/bots", (req, res) => {
    (req);
    res.json(bots)
    res.end()
})
app.get("/kill", (req, res) => {
    const id = req.query["id"]
    const killProcesses = Processes.find(x => x.id == id)
    const killBotIDX = bots.findIndex(x => x.id == id)
    if (killProcesses) {
        killProcesses.Process.kill()
    }
    if (killBotIDX != -1) {
        bots.splice(killBotIDX, 1)
    }
    res.end()
})

host.listen(PORT)