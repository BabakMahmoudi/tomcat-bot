import tomcat from '@gostarehnegar/tomcat'
import redis from "redis";
//import { CandleStickData } from '@gostarehnegar/tomcat/build/main/lib/common';
console.log("hello world1", tomcat.utils.toTimeEx());
const client = redis.createClient("redis://public-redis:6379");

(async () => {
    return new Promise((resolve, reject) => {
        client.info((err) => {
            if (err) {
                console.log(err);
                reject(err)
            }
            else {
                client.set("paria1", "mahmoudi1", (e, i) => {
                    if (e) {
                        console.log(e);
                        reject(e);

                    }
                    else {
                        console.log('succcess');
                        resolve(i)
                    }

                });
            }


        });

    })

})();


// const ok = client.set("paria", "mahmoudi", (err) => {
//     console.log(err);

// });
// console.log(ok);



