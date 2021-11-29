import tomcat from '@gostarehnegar/tomcat'
import { BotProcess } from './BotProcess';
tomcat.config.data.redis.publicUrl = "redis://localhost:6379";
tomcat.config.messaging.transports.websocket.diabled = true;
var bus = new tomcat.Infrastructure.Bus.RedisBus();

const host = tomcat.hosts.getHostBuilder("mohsen").buildWebHost('express')
const bots = []
const app = host.expressApp

bus.subscribe("Mohsen/start",(m)=>{
    console.log(m.content<string>());
})
app.get('/start', async (req , res) => {
    const conf = req.body
    var bot = new BotProcess("../tomcat-bots-talib/build/main/Mohsen/index.js");
    bots.push(bot)
    res.end()
    await bot.Start( conf );
})

app.get("/bots",(req,res)=>{
    (req);
    res.json(bots)
    res.end()
})


host.listen(8001)