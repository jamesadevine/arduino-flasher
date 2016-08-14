//const MBED_VENDOR_ID = 9025
//const MBED_PRODUCT_ID = 32845



var globalPorts;

var currentFileEntry =  null;



function onClick(e)
{
    var selectedPort = globalPorts[Number(e.srcElement.id)];

    if(currentFileEntry.fullPath.indexOf(".hex") < 0)
    {
        toastr.error("That's not a hex file!",'Error');
        return;
    }

    $(".loading").show();

    console.log(currentFileEntry)
    currentFileEntry.file(function(file) {
        var reader = new FileReader();

        //reader.onerror = errorHandler;
        reader.onloadend = function(e) {
            arduino.flash(e.target.result, selectedPort, function(err,result){
                if(err)
                    toastr.error(result, 'Error');
                else
                    toastr.success('Your arduino has been flashed.', 'Success');
                $(".loading").hide();
            })
        };

        reader.readAsText(file);
   });
}

function list()
{
    $(".loading").show();

    arduino.find().then(function(ports){
        console.log("RET PORTS ", ports)

        var html = "";

        globalPorts = ports;

        for (var i=0; i < ports.length; i++)
            html += '<tr><td>' + ports[i].displayName + '</td><td>' + ports[i].path + '</td><td><button style="vertical-align:middle;" class="button-select btn btn-default arduino-button" id="' + i + '" type="button">Flash</button><i id="' + i + '" class="info icon-button glyphicon glyphicon-info-sign" type="button"></i><i id="' + i + '" class="reset icon-button glyphicon glyphicon-off" type="button"></i></td></tr>'

        if(html.length == 0)
            html = '<tr><td>No devices found.</td></tr>'

        var $html = $(html);

        if(currentFileEntry == null)
        {
            $html.find(".button-select").each(function(idx,el){
                console.log(idx,el);
                $(el).attr('disabled',true);
            })
        }

        $("#device-table").html($html);

        $(".info").on("click",function(e){
            console.log(e);
            var selectedPort = globalPorts[Number(e.currentTarget.id)];
            $(".loading").show();

            arduino.version(selectedPort,function(err,result){
                if(err)
                    toastr.error(result,"Error");
                else
                    toastr.info(result);
                $(".loading").hide();
            })
        });

        $(".reset").on("click",function(e){
            console.log(e);
            var selectedPort = globalPorts[Number(e.currentTarget.id)];
            $(".loading").show();

            arduino.reset(selectedPort,function(err,result){
                if(err)
                    toastr.error("Your arduino could not be reset.","Error");
                else
                    toastr.success('Your arduino has been reset.', 'Success');

                $(".loading").hide();

                setTimeout(list,100);
            })
        });

        var elements = document.getElementsByClassName("button-select");

        for (var i = 0 ; i < elements.length; i++)
        {
            elements[i].addEventListener("click",onClick)
        }

        $(".loading").hide();
    });
}

$(document).ready(function(){
    dnd.on('body',{
        'enter':function(el)
        {
            el.classList.add("dndHover");
        },
        'drop':function(data,el) {
            console.log(data);
            if(data.items.length == 1 && data.files[0].name.indexOf(".hex") > 0)
            {
                if(currentFileEntry == null)
                {
                    $("#device-table").find(".button-select").each(function (idx,el){
                        $(el).attr("disabled",false);
                    });
                }

                currentFileEntry = data.items[0].webkitGetAsEntry()
                $("#file").text("File: "+currentFileEntry.name);
            }else {
                toastr.error("That's not a hex file!",'Error');
            }

            el.classList.remove("dndHover")
        },
        'leave':function(el)
        {
            el.classList.remove("dndHover")
        }
    })

    list();

    $("#refresh").on("click",list);
})
