// Selektovanje DOM elemenata
const canvas = document.querySelector("canvas");
const toolOptions = document.querySelectorAll(".tools-board .tool");
const fillShapeCheckbox = document.querySelector("#fill-shape");
const sizeSlider = document.querySelector("#size-slider");
const colorButtons = document.querySelectorAll(".colors .option");
const customColor = document.querySelector("#custom-color");
const undoredoButtons = document.querySelectorAll(".actions-toolbar li");
const clearCanvasButton = document.querySelector(".clear");
const saveImageButton = document.querySelector(".save");
const context = canvas.getContext("2d");

// Draw state
let drawingHistory = [];
let redoHistory = [];
let currentStep = 0;
let isDrawing = false;
let brushSize = 5;
// let selectedColor = "#000";
let selectedColor = "rgb(0, 0, 0)"
let selectedTool = "brush";
let prevMousePoint = { x: 0, y: 0 };
let canvasSnapshot = null;

// Canvas Init
const initCanvas = () => {
    document.documentElement.style.setProperty('--doc-height', `${window.innerHeight}px`);
    const dpr = window.devicePixelRatio || 1;
    const canvasRect = canvas.getBoundingClientRect();
    canvas.width = canvasRect.width * dpr;
    canvas.height = canvasRect.height * dpr;
    context.scale(dpr, dpr);
}

// Canvas reset
const resetCanvas = () => {
    initCanvas();
    context.fillStyle = "#fff";
    context.fillRect(0,0, canvas.width, canvas.height);
    drawingHistory.push(localStorage.getItem("savedDrawing") || canvas.toDataURL());
}

const getImageSize = (image) => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const canvasRect = canvas.getBoundingClientRect();
    const aspectRatio = image.width / image.height;
    const newWidth = canvasRect.width;
    const newHeight = newWidth / aspectRatio;
    return { newWidth, newHeight };
}

// Ucitavanje crteza iz local storagea na canvas
const loadLocalStorageDrawing = () => {
    const savedDrawing = localStorage.getItem("savedDrawing");
    if (!savedDrawing) return;

    const image = new Image();
    image.src = savedDrawing;
    image.onload = () => {
        const { newWidth, newHeight } = getImageSize(image);
        context.drawImage(image, 0, 0, newWidth, newHeight);
    }
}

// Cuvanje crteza na local storage
const saveDrawingToLocalStorage = () => {
    const canvasDrawing = canvas.toDataURL();
    localStorage.setItem("savedDrawing", canvasDrawing);
}

// Cuvanje stanje crteza po varijablama
const saveDrawingState = () => {
    if (currentStep < drawingHistory.length - 1) {
        drawingHistory = drawingHistory.slice(0, currentStep + 1);
    }
    currentStep++;
    drawingHistory.push(canvas.toDataURL());
    redoHistory = [];
    saveDrawingToLocalStorage();
}

// Reset stanja kanvasa
const resetDrawingState = () => {
    localStorage.removeItem("savedDrawing");
    drawingHistory = [];
    redoHistory = [];
    currentStep = 0;
    resetCanvas();
}

// Dvojna funkcionalnost za undo i redo
const activateUndoRedo = (selectedButton) => {
    if (selectedButton.id === "undo" && currentStep > 0) {
        currentStep--;
        redoHistory.push(drawingHistory[currentStep + 1]);
    } else if (selectedButton.id === "redo" && redoHistory.length > 0) {
        currentStep++;
        drawingHistory.push(redoHistory.pop());
    } else {
        return;
    }

    const image = new Image();
    image.src = drawingHistory[currentStep];
    image.onload = () => {
        const { newWidth, newHeight } =getImageSize(image);
        context.drawImage(image, 0, 0, newWidth, newHeight);
        saveDrawingToLocalStorage();
    }
}

// Uzimanje trenutne lokacije kursora
const cursorLocation = (e) => {
    let x = ("ontouchstart" in window ? e.touches?.[0]?.pageX : e.pageX) - canvas.offsetLeft;
    let y = ("ontouchstart" in window ? e.touches?.[0]?.pageY : e.pageY) - canvas.offsetTop;
    return { x, y };
}

// Crtanje Linije
const drawLine = (position) => {
    context.beginPath();
    context.moveTo(prevMousePoint.x, prevMousePoint.y);
    context.lineTo(position.x, position.y);
    context.stroke();
}

// Crtanje pravougaonika
const drawRect = (position) => {
    context.beginPath();
    const width = position.x - prevMousePoint.x;
    const height = position.y - prevMousePoint.y;
    context.rect(prevMousePoint.x, prevMousePoint.y, width, height);
    //za fill
    fillShapeCheckbox.checked ? context.fill() : context.stroke();
    context.closePath();
}

// Crtanje kruga
const drawCircle = (position) => {
    context.beginPath();
    let r = Math.sqrt(Math.pow((prevMousePoint.x - position.x), 2)
                        + Math.pow((prevMousePoint.y - position.y), 2));
    context.arc(prevMousePoint.x, prevMousePoint.y, r, 0, 2* Math.PI);

    fillShapeCheckbox.checked ? context.fill() : context.stroke();
    context.closePath();
}

// Crtanje trougla
const drawTriangle = (position) => {
    context.beginPath();
    context.moveTo(prevMousePoint.x, prevMousePoint.y);
    context.lineTo(position.x, position.y);
    context.lineTo(prevMousePoint.x * 2 - position.x, position.y);
    context.closePath();

    fillShapeCheckbox.checked ? context.fill() : context.stroke();
}

// Funkcija za pocetni stroke
const drawStart = (e) => {
    e.preventDefault();
    isDrawing = true;
    context.beginPath();
    context.lineCap = "round";
    prevMousePoint = cursorLocation(e);
    context.lineWidth = brushSize;
    context.strokeStyle = selectedColor;
    context.fillStyle = selectedColor;
    canvasSnapshot = context.getImageData(0, 0, canvas.width, canvas.height);
    if (selectedTool === "fill") {
        floodFill(prevMousePoint, getRGB(selectedColor));
    } else if (selectedTool === "brush" || selectedTool === "eraser") {
        context.strokeStyle = selectedTool === "eraser" ? "#fff" : selectedColor;
        context.lineTo(prevMousePoint.x, prevMousePoint.y);
        context.stroke();
    }
}

// Funkcija za saaamo crtanje
const drawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    let position = cursorLocation(e);
    context.clearRect(0,0,canvas.width,canvas.height);
    context.putImageData(canvasSnapshot, 0, 0);

    if (selectedTool === "brush" || selectedTool === "eraser") {
        context.strokeStyle = selectedTool === "eraser" ? "#fff" : selectedColor;
        context.lineTo(position.x, position.y);
        context.stroke();
    } else if(selectedTool === "line") {
        drawLine(position);
    } else if(selectedTool === "rectangle") {
        drawRect(position);
    }else if(selectedTool === "circle") {
        drawCircle(position);
    } else if(selectedTool === "triangle"){
        drawTriangle(position);
    }
    context.stroke();
}

// Funkcija za kraj strokea
const drawStop = () => {
    if (!isDrawing) return;
    isDrawing = false;
    saveDrawingState();
}

//Event listeneri

//Tools
toolOptions.forEach(tool => {
    tool.addEventListener("click", () => {
        document.querySelector( ".options .active").classList.remove("active");
        tool.classList.add("active");
        selectedTool = tool.id;
    });
});

//Prokleti slider
sizeSlider.addEventListener("change", (e) => {
    e.preventDefault();
    brushSize = sizeSlider.value;
});

//Colours
colorButtons.forEach(button => {
    button.addEventListener("click", () => {
        document.querySelector(".colors .selected").classList.remove("selected");
        button.classList.add("selected");
        selectedColor = window.getComputedStyle(button).getPropertyValue("background-color");
    });
});

//Custom Colour
customColor.addEventListener("input", (e) => {
    customColor.parentElement.classList.add("active");
    customColor.parentElement.style.backgroundColor = e.target.value;
    customColor.parentElement.click();
});

// undo i redo
undoredoButtons.forEach(button => {
    button.addEventListener("click", () => activateUndoRedo(button));
});

//copy i paste

// Cuvanje slike na kanvasu
saveImageButton.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `${new Date().getTime()}.jpg`;
    link.href = canvas.toDataURL();
    link.click();
})

// Ciscenje kanvasa
clearCanvasButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the canvas?")) resetDrawingState();
});

// Ucitavanje poslednje slike
window.addEventListener("load", () => {
    resetCanvas();
    loadLocalStorageDrawing();
})

window.addEventListener("orientationchange", resetDrawingState);
window.addEventListener("resize", resetCanvas);

canvas.addEventListener("mousedown", drawStart);
canvas.addEventListener("touchstart", drawStart);
canvas.addEventListener("mousemove", drawing);
canvas.addEventListener("touchmove", drawing);
canvas.addEventListener("mouseup", drawStop);
canvas.addEventListener("mouseleave", drawStop);
canvas.addEventListener("touchend", drawStop);

// NOVI FLOOD FILL

function floodFill(position, color) {
    console.log(`FloodFill start`);
    let pixel_stack = [{x: position.x, y: position.y}];
    let pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let linear_cords = (position.y * canvas.width + position.x) * 4;
    let original_color = {
        r: pixels.data[linear_cords],
        g: pixels.data[linear_cords + 1],
        b: pixels.data[linear_cords + 2],
        a: 255
    };

    if (!(color[3] === 255)) {
        color[3] = 255;
    }

    if (original_color.r === color[0] &&
        original_color.g === color[1] &&
        original_color.b === color[2])
    {
        console.log(`First pixel is matching, aborting floodFill`);
        return;
    }

    let new_pixel;
    let x;
    let y;
    while (pixel_stack.length > 0) {
        new_pixel = pixel_stack.shift();
        x = new_pixel.x;
        y = new_pixel.y;

        //console.log( x + ", " + y ) ;


        linear_cords = (y * canvas.width + x) * 4;
        while (y-- >= 0 &&
        (   pixels.data[linear_cords] == original_color.r &&
            pixels.data[linear_cords + 1] == original_color.g &&
            pixels.data[linear_cords + 2] == original_color.b)) {
            linear_cords -= canvas.width * 4;
        }
        linear_cords += canvas.width * 4;
        y++;

        let reached_left = false;
        let reached_right = false;
        while (y++ < canvas.height &&
        (   pixels.data[linear_cords] == original_color.r &&
            pixels.data[linear_cords + 1] == original_color.g &&
            pixels.data[linear_cords + 2] == original_color.b))
        {
            pixels.data[linear_cords] = color[0];
            pixels.data[linear_cords + 1] = color[1];
            pixels.data[linear_cords + 2] = color[2];

            if (x > 0) {
                if (pixels.data[linear_cords - 4] == original_color.r &&
                    pixels.data[linear_cords - 4 + 1] == original_color.g &&
                    pixels.data[linear_cords - 4 + 2] == original_color.b) {
                    if (!reached_left) {
                        // if(is_in_pixel_stack(x - 1, y, pixel_stack)){
                        //     pixel_stack.push({x: x - 1, y: y});
                        //     reached_left = true;
                        // }
                        pixel_stack.push({x: x - 1, y: y});
                        reached_left = true;
                    }
                } else if (reached_left) {
                    reached_left = false;
                }
            }

            if (x < canvas.width - 1) {
                if (pixels.data[linear_cords + 4] == original_color.r &&
                    pixels.data[linear_cords + 4 + 1] == original_color.g &&
                    pixels.data[linear_cords + 4 + 2] == original_color.b) {
                    if (!reached_right) {
                        // if(is_in_pixel_stack(x + 1, y, pixel_stack)) {
                        //     pixel_stack.push({x: x + 1, y: y});
                        //     reached_right = true;
                        // }
                        pixel_stack.push({x: x + 1, y: y});
                        reached_right = true;
                    }
                } else if (reached_right) {
                    reached_right = false;
                }
            }

            linear_cords += canvas.width * 4;
        }
    }
    context.putImageData( pixels, 0, 0 ) ;
}

function is_in_pixel_stack( x, y, pixel_stack ) {
    for(let i=0 ; i<pixel_stack.length ; i++ ) {
        if( pixel_stack[i].x==x && pixel_stack[i].y==y ) {
            return true ;
        }
    }
    return false ;
}

function generate_random_color() {
    var letters = '0123456789ABCDEF' ;
    var color = '#' ;
    for( var i=0; i<6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)] ;
    }
    return color ;
}

// adapted from https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function color_to_rgba( color ) {
    if( color[0]=="#" ) { // hex notation
        color = color.replace( "#", "" ) ;
        var bigint = parseInt(color, 16);
        var r = (bigint >> 16) & 255;
        var g = (bigint >> 8) & 255;
        var b = bigint & 255;
        return {r:r,
            g:g,
            b:b,
            a:255} ;
    } else if( color.indexOf("rgba(")==0 ) { // already in rgba notation
        color = color.replace( "rgba(", "" ).replace( " ", "" ).replace( ")", "" ).split( "," ) ;
        return {r:color[0],
            g:color[1],
            b:color[2],
            a:color[3]*255} ;
    } else {
        console.error( "warning: can't convert color to rgba: " + color ) ;
        return {r:0,
            g:0,
            b:0,
            a:0} ;
    }
}


// Stari Flood fill function za Fill Color tool
function stariFloodFill(position) {
    const imageData = context.getImageData(0,0, canvas.width,canvas.height);
    console.log(context.getImageData(0, 0, canvas.width, canvas.height));
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    // const stack = [[position.x, position.y]];
    const stack = [[Math.floor(position.x), Math.floor(position.y)]];
    const visited = new Set();
    let pixelCount = 0;

    let targetColor = getPixelColor(data, position.x, position.y);

    //tretiramo transparentne tjst "neobojene" piksele kao bele
    if (targetColor[3] === 0) {
        targetColor[3] = 255;
    }

    if (colorsMatch(targetColor, selectedColor)) return;

    while(stack.length > 0){
        const [x,y] = stack.pop();
        const cx = Math.floor(x);
        const cy = Math.floor(y);

        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);

        // proveravamo granice canvasa
        if(cx < 0 || cy < 0 || cx >= canvas.width || cy >= canvas.height) {
            console.log(`Skipping out-of-bounds pixel at (${cx}, ${cy})`);
            continue;
        }

        const currentColor = getPixelColor(data, cx, cy);
        // console.log("Current:", currentColor, "Target:", targetColor);

        //ova linija se preskace ukoliko nisu iste boje - samo nam je za exit kada se nadje ista boja
        if (!colorsMatch(currentColor, targetColor)) {
            continue;
        }

        // farbamo pixel
        setPixelColor(data, cx, cy, selectedColor);

        //dodajemo komsije
        stack.push([cx - 1, cy]); //levo
        stack.push([cx + 1, cy]); //desno
        stack.push([cx, cy - 1]); //dole
        stack.push([cx, cy + 1]); //gore

        // Progress tracking (for large fills)
        pixelCount++;
        if (pixelCount % 1000 === 0) {
            console.log(`Processed ${pixelCount} pixels...`);
        }

    }

    // context.clearRect(0, 0, canvas.width, canvas.height);
    context.putImageData(imageData, 0, 0);
}

function getPixelColor (data, x, y) {
    const index = (y * canvas.width +x) *4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    console.log(`Pixel at (${x}, ${y}):`, [r,g,b,a]);
    if(a < 255) return [r,g,b,255];
    return [r,g,b,a];
}

function setPixelColor (data, x, y, color) {
    const index = (y * canvas.width + x) * 4;
    const rgb = getRGB(selectedColor);
    data[index] = rgb[0];     // Red
    data[index + 1] = rgb[1]; // Green
    data[index + 2] = rgb[2]; // Blue
    data[index + 3] = 255;     // Alpha (fully opaque)
}

function colorsMatch(color1, color2) {
    const match =
        color1[0] === color2[0] &&
        color1[1] === color2[1] &&
        color1[2] === color2[2] &&
        color1[3] === color2[3];

    return match;
}

function getRGB(rgbString){
    // Use a regular expression to extract the numbers from the string
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

    // If the string is not in the correct format, return null or handle the error
    if (!match) {
        throw new Error("Invalid RGB format");
    }

    // Convert the matched values to integers and return them as an array
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}
