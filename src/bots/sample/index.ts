import tomcat from "@gostarehnegar/tomcat";
import { Pipeline } from "@gostarehnegar/tomcat/build/main/lib/pipes";
import { RedisBus } from "../../RedisBus";
import { Utils } from "../../Utils";
const cfg = Utils.ReadConfig<any>(__dirname);
//console.log(Utils)
//tomcat.config.data.redis.publicUrl = 'redis://localhost:6380';
const name = "sample";
const bus = RedisBus.Bus;
var pipeline = new Pipeline();
tomcat.config.proxy.url = "http://localhost:2395";
pipeline.from('binance', 'spot', 'BTCUSDT', '1m')
    .add(candle => {
        bus.publish('candle', candle);
        return Promise.resolve();
    });
const startTime = tomcat.utils.toTimeEx(Date.UTC(2020, 0, 1, 0, 0, 0, 0)).addMinutes(-30 * 1440)
//const endTime = tomcat.utils.toTimeEx(Date.UTC(2021, 0, 1, 0, 0, 0, 0));

pipeline.start(startTime);


bus.subscribe('sample:*', m => {
    console.log(`Received Message: ${m.content<string>()} ${tomcat.utils.toTimeEx()}`)

});
setInterval(() => {
    //console.log(Date.now());
    //console.log(tomcat.config.data.redis.publicUrl);
    bus.publish('bots:ping', `Ping From ${name} Param: ${cfg.param} at ${new Date().toISOString()}`)
}, 2000)