var CONNECTION_ID = -1;

var MAX_MS = 2000;

const GENUINO_VENDOR_IDS = [9025]
const GENUINO_PRODUCT_IDS = [589, 77]

const PACKET_SIZE = 4096

//ARDUINO ZERO
//const GENUINO_VENDOR_ID = 9025
//const GENUINO_PRODUCT_ID = 32845

//CMSIS DAP
//const GENUINO_VENDOR_ID = 1003
//const GENUINO_PRODUCT_ID = 8535


const TYPE_DAT = 0x00;
const TYPE_EOF = 0x01;
const TYPE_ESA = 0x02;
const TYPE_SSA = 0x03;
const TYPE_ELA = 0x04;
const TYPE_SLA = 0x05;

var serial_buffer = "";

function write_cb(buffer, cb)
{
    if(CONNECTION_ID == -1)
    {
        cb(true, "invalid connection")
        return;
    }

    var buf = new Uint8Array(buffer)

    //console.log("WRITING ", String.fromCharCode.apply(null, new Uint8Array(buffer)), new Uint8Array(buffer));

    //the MAX transmission of a chrome serial write is 200 bytes, we therefore
    //marshall the given buffer into 200 byte chunks, and serialise their execution.
    var send = []

    var total = buf.length;

    var bufferTotal = 0;

    while(bufferTotal < buf.length)
    {
        var bufferSize = (total < 200) ? total : 200;

        //closure to ensure our buffer is local.
        (function(buf2send){
            send.push(function(callback){
                //console.log("SENDING ",new Uint8Array(buf2send),new Uint8Array(buf2send).length);
                chrome.serial.send(CONNECTION_ID, buf2send, function(writeInfo){
                    if(writeInfo.error)
                        callback(true,writeInfo.error);
                    else
                        callback(null);
                })
            })
        })(buffer.slice(bufferTotal,bufferTotal + bufferSize))

        bufferTotal += bufferSize;
        total -= bufferSize;
    }

    //execute!
    async.series(send,function(err,result){
        cb(err);
    })
}

function read_cb(callback)
{
    var time = 0;

    var timeout = function(){
        setTimeout(function() {

            time += 50;

            console.log(time);
            //we presume the content returned is ok, we essentially block until "something is returned"
            if(serial_buffer.length > 0)
            {
                var t = serial_buffer;
                serial_buffer = "";
                callback(null,t);
                return;
            }else if(time > MAX_MS)
            {
                callback(true,"TIMED OUT");
                return;
            }

            timeout();
        }, 50);
    }
    timeout();
}

function ls(){
    return new Promise(function(fulfill,reject){
        chrome.serial.getDevices(function(ports){
            var retPorts = []

            console.log(chrome.app, window.navigator);



            $(ports).each(function(idx, port){
                console.log("P ",port)

                var vendorMatch = false;
                var pIDMatch = false;

                for(var i = 0; i < GENUINO_VENDOR_IDS.length; i++)
                    if(port.vendorId == GENUINO_VENDOR_IDS[i])
                        vendorMatch = true;

                for(var i = 0; i < GENUINO_PRODUCT_IDS.length; i++)
                    if(port.productId == GENUINO_PRODUCT_IDS[i])
                        pIDMatch = true;

                if(vendorMatch && pIDMatch)
                    if(port.path.indexOf("tty") > 0)
                        retPorts.push(port);
                    else if(window.navigator.appVersion.indexOf("Windows") > -1)
                        retPorts.push(port);

            })

            fulfill(retPorts);
        });
    })

}

function connect_cb(port, options, callback)
{
    if(CONNECTION_ID != -1)
    {
        callback(true,"There is an already open connection")
        return;
    }

    if(typeof options == "undefined")
        options = null;

    chrome.serial.connect(port.path, options, function(openInfo){
        CONNECTION_ID = openInfo.connectionId;

        console.log("CONNECTED ",openInfo);

        if (CONNECTION_ID == -1) {
            callback(true, "Invalid connection!")
        }else {
            callback(null)
        }
    });
}

function disconnect_cb(cb)
{
    if(CONNECTION_ID == -1)
    {
        cb(true,'Could not connect to serial');
        return;
    }

    chrome.serial.disconnect(CONNECTION_ID, function(result){
        if (!result) {
            cb(true,'Could not connect to serial');
        }else {
            CONNECTION_ID = -1;
            cb(null,'');
        }
    });
}

function padToN(number,numberToPad) {

    var str = ""

    for(var i = 0; i < numberToPad; i++)
        str = str + "0"

    return (str+number).slice(-numberToPad);
}

function num2hexstr(number, paddedTo)
{
    return padToN(number.toString(16),paddedTo);
}

function hex2byte(hex){
    var bytes = []

    for (var i = 0; i < hex.length; i += 2)
        bytes.push(parseInt(hex.substr(i, 2), 16));

    return bytes;
}

function str2ab(str) {
    var buf = new ArrayBuffer(str.length); // 2 bytes for each char
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
        bufView[i] = str.charCodeAt(i) & 0xFF;
    }
    return buf;
}

function ihex_decode(line)
{
    var offset = 0;

    var byteCount = parseInt(line.substr(offset, 2), 16);
    offset += 2;
    var address = parseInt(line.substr(offset, 4), 16);
    offset += 4;
    var recordtype = parseInt(line.substr(offset, 2), 16);
    offset += 2;

    var byteData = hex2byte(line.substr(offset, byteCount * 2));

    var bytes = new ArrayBuffer(byteData.length);
    var bytesView = new Uint8Array(bytes,0,byteData.length);

    for(var i =0; i < byteData.length; i++)
        bytesView[i] = byteData[i];

    return {
        str:line,
        len:byteCount,
        address:address,
        type:recordtype,
        data:bytesView
    }
}

var arduino =   {
    find:function(){
        return ls();
    },
    version:function(port,finished){
        var func_array = []
        func_array.push(function(callback){connect_cb(port,{"bitrate":115200},callback)});
        func_array.push(function(callback){write_cb(str2ab("V#"),callback)});
        func_array.push(function(callback){read_cb(callback)});
        func_array.push(function(callback){disconnect_cb(callback)});

        async.series(func_array,function(err, result){
            finished(err,result);
        })
    },
    reset:function(port,finished){
        var func_array = []
        func_array.push(function(callback){connect_cb(port,{"bitrate":115200},callback)});
        func_array.push(function(callback){write_cb(str2ab("WE000ED0C,05FA0004#"),callback)});
        func_array.push(function(callback){disconnect_cb(callback)});
        async.series(func_array,function(err, result){
            finished(err,result);
        })
    },
    flash: function(file, port, finished){

        var func_array = []

        func_array.push(function(callback){connect_cb(port,{"bitrate":115200},callback)});

        //CLEAR line
        func_array.push(function(callback){write_cb(str2ab("N#"),callback)});
        func_array.push(function(callback){read_cb(callback)});

        //ERASE device
        func_array.push(function(callback){write_cb(str2ab("X00002000#"),callback)});
        func_array.push(function(callback){read_cb(callback)});

        file = file.replace(/(?:\r\n|\r|\n)/g, '');

        var lines = file.split(':');
        lines.splice(0,1);

        var dataObjects = []
        var total = 0;

        for(var i = 0; i < lines.length; i++)
        {
            var hex = ihex_decode(lines[i])

            if(hex.type == TYPE_DAT || hex.type == TYPE_ELA)
            {
                total += hex.len;
                dataObjects.push(hex);
            }
        }

        var hexCount = 0;
        var address = dataObjects[0].address;

        if(address < 2000)
        {
             finished(true, "You're attempting to overwrite the bootloader... (0x" + padToN(num2hexstr(dataObjects[0].address),8) + ")");
             return;
        }

        var i =0;

        while(total > 0)
        {

            var bufferSize = (total < PACKET_SIZE) ? total : PACKET_SIZE;

            var buffer = new ArrayBuffer(bufferSize);

            var bufferTotal = 0;

            while(bufferTotal < bufferSize)
            {
                var currentHex = dataObjects[hexCount];

                if(bufferSize - currentHex.len < bufferTotal)
                {
                    //break early, we cannot completely fill the buffer.
                    bufferSize = bufferTotal;
                    var t = buffer.slice(0,bufferTotal);
                    buffer = t;
                    break;
                }

                //check for Extended linear addressing...
                if(currentHex.type == TYPE_ELA)
                {
                    if(bufferTotal > 0)
                    {
                        //break early, we're going to move to a different memory vector.
                        bufferSize = bufferTotal;
                        var t = buffer.slice(0,bufferTotal);
                        buffer = t;
                        break;
                    }

                    //set the address if applicable...
                    address = (currentHex.address << 16);
                }

                new Uint8Array(buffer, bufferTotal, currentHex.len).set(currentHex.data);

                hexCount++;
                bufferTotal += currentHex.len
            }

            //Closure to make sure we localise variables
            (function(localAddress,localBufferSize, localBuffer){

                //tell the arduino we are writing at memory 20005000, for N bytes.
                func_array.push(function(callback){
                    console.log("LOCAL SIZE ",localBufferSize)
                    write_cb(str2ab("S20005000,"+num2hexstr(localBufferSize,8)+"#"), callback)
                });

                //write our data.
                func_array.push(function(callback){
                    write_cb(localBuffer, callback)
                });

                //set our read pointer
                func_array.push(function(callback){write_cb(str2ab("Y20005000,0#"), callback)})

                //wait for ACK
                func_array.push(function(callback){read_cb(callback)})

                //copy N bytes to memory location Y.
                func_array.push(function(callback){
                    write_cb(str2ab("Y" + num2hexstr(localAddress, 8) + "," + num2hexstr(localBufferSize,8) + "#"), callback)
                });

                //wait for ACK
                func_array.push(function(callback){read_cb(callback)})
            }(address,bufferSize,buffer));

            total -= bufferSize;
            i++;
            address += bufferSize;
        }
        //CLEANUP
        func_array.push(function(callback){write_cb(str2ab("WE000ED0C,05FA0004#"),callback)});
        //func_array.push(function(callback){write_cb(str2ab("WE000ED0C,05FA0004"),callback)});

        //DISCONNECT
        func_array.push(function(callback){disconnect_cb(callback)});

        //execute our functions in series!
        async.series(func_array,function(err, results){
            if(err)
                finished(true, results);
            else
                finished(false,"");
        })
    }
}

chrome.serial.onReceiveError.addListener(function(info){
    console.log("INFO ", info);
    if(info.connectId == CONNECTION_ID && info.error == "disconnected")
    {
        console.log("DISCONNECTED BY THINGY");
        CONNECTION_ID = -1;
    }
})

chrome.serial.onReceive.addListener(function(info){

    console.log("RX CONNECTION_ID ",info.connectionId," DATA ",String.fromCharCode.apply(null, new Uint8Array(info.data)), new Uint8Array(info.data));
    serial_buffer += String.fromCharCode.apply(null, new Uint8Array(info.data));
})
