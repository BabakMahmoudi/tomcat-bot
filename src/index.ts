import tomcat from '@gostarehnegar/tomcat'
import { BotProcess } from './BotProcess';
import { } from './'
import { RedisBus } from './RedisBus';
import { CandleStickData, Utils } from '@gostarehnegar/tomcat/build/main/lib/common';
tomcat.config.data.redis.publicUrl = "redis://localhost:6380";
tomcat.config.messaging.transports.websocket.diabled = true;
//import redis from "redis";
//import { CandleStickData } from '@gostarehnegar/tomcat/build/main/lib/common';
//console.log("hello world1", tomcat.utils.toTimeEx());
(CandleStickData)
var bot = new BotProcess("sample");
(bot);
var bus = new RedisBus();
(async () => {

    bus.subscribe('bots:*', m => {
        console.log(`Ping ${m.content<string>()}`);
    });
    bus.subscribe('candle', m => {
        console.log(`Candle: ${m.content<CandleStickData>().openTime}`);
    });

    // bus.subscribe('bots:ping', m => {
    //     console.log('ping only', `Ping ${m.content<string>()}`);
    // });
    //await Utils.instance.delay(3000);

    //bus.publish('bots:ping', `Ping From ${'ame'} at ${new Date().toISOString()}`);
    await bot.prepareWorkspace();
    await bot.Start(Object.assign(tomcat.config, { 'param': 'babak' }));

    // //await Utils.WriteText();
    while (true) {
        //bus.publish("sample:ping", "hi bot");
        await Utils.instance.delay(100);
    }

})();
// const client = redis.createClient("redis://public-redis:6379");

// (async () => {
//     return new Promise((resolve, reject) => {
//         client.info((err) => {
//             if (err) {
//                 console.log(err);
//                 reject(err)
//             }
//             else {
//                 client.set("paria1", "mahmoudi1", (e, i) => {
//                     if (e) {
//                         console.log(e);
//                         reject(e);

//                     }
//                     else {
//                         console.log('succcess');
//                         resolve(i)
//                     }

//                 });
//             }


//         });

//     })

// })();


// const ok = client.set("paria", "mahmoudi", (err) => {
//     console.log(err);

// });
// console.log(ok);



