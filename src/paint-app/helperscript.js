// Selektovanje DOM elemenata
const canvas = document.querySelector("canvas");
const toolOptions = document.querySelectorAll(".tools-board .tool");
const fillShapeCheckbox = document.querySelector("#fill-shape");
const sizeSlider = document.querySelector("#size-slider");
const colorButtons = document.querySelectorAll(".colors .option");
const customColor = document.querySelector("#custom-color");
// const undoredoButtons = document.querySelectorAll(".actions-toolbar li");
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const copyButton = document.getElementById("copy");
const pasteButton = document.getElementById("paste");
const clearCanvasButton = document.querySelector(".clear");
const saveImageButton = document.querySelector(".save");
const insertImageButton = document.querySelector(".upload");
const context = canvas.getContext("2d");
// const context = canvas.getContext("2d", {alpha: false});

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
let selectionMode = "regular"; // regular | lasso

// Canvas Init
const initCanvas = () => {
    document.documentElement.style.setProperty('--doc-height', `${window.innerHeight}px`);

    const canvasRect = canvas.getBoundingClientRect();
    canvas.width = canvasRect.width;
    canvas.height = canvasRect.height;

    context.setTransform(1, 0, 0, 1, 0, 0);
    setupImageUploader();
    // context.imageSmoothingEnabled= false;
    syncOverlaySize();
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
    // let x = ("ontouchstart" in window ? e.touches?.[0]?.pageX : e.pageX) - canvas.offsetLeft;
    // let y = ("ontouchstart" in window ? e.touches?.[0]?.pageY : e.pageY) - canvas.offsetTop;
    // return { x, y };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if(e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    return{
        x: clientX - rect.left,
        y: clientY - rect.top
    };
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
    } else if(selectedTool === "select") {
        context.lineWidth = 1;
        startSelection(e);
    } else if(selectedTool === "selectLasso") {
        context.lineWidth = 1;
        selectionMode = "lasso";
        startSelection(e);
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

    if (selectedTool === "select"){
        updateSelection(e);
        return; //moramo izdvojiti da bi crtalo iskljucivo na overlayu i ne na canvasu
    }

    context.clearRect(0,0,canvas.width,canvas.height);
    context.putImageData(canvasSnapshot, 0, 0);

    if (selectedTool === "brush" || selectedTool === "eraser") {
        context.strokeStyle = selectedTool === "eraser" ? "#fff" : selectedColor;
        context.lineTo(Math.round(position.x), Math.round(position.y));
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
    if (selectedTool === "select") {
        stopSelection();
    }
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
// undoredoButtons.forEach(button => {
//     button.addEventListener("click", () => activateUndoRedo(button));
// });

if (undoButton && redoButton) {
    undoButton.addEventListener("click", () => activateUndoRedo(undoButton));
    redoButton.addEventListener("click", () => activateUndoRedo(redoButton));
}

//copy i paste

if (copyButton) {
    copyButton.addEventListener("click", () => {
        if (selection && selection.imageData) {
            copySelection();
        }
    });
}

if (pasteButton) {
    pasteButton.addEventListener("click", () => {
        if (selectionClipboard) {
            pasteSelection();
        }
    });
}


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

// Upload slike preko buttona
insertImageButton.addEventListener("click", () => {
        document.getElementById('imageUploader').click();
})

// Ucitavanje poslednje slike
window.addEventListener("load", () => {
    resetCanvas();
    loadLocalStorageDrawing();
})

window.addEventListener("orientationchange", resetDrawingState);

window.addEventListener("resize", () => {
    resetCanvas();
    loadLocalStorageDrawing();
})

canvas.addEventListener("mousedown", drawStart);
canvas.addEventListener("touchstart", drawStart);
canvas.addEventListener("mousemove", drawing);
canvas.addEventListener("touchmove", drawing);
canvas.addEventListener("mouseup", drawStop);
canvas.addEventListener("mouseleave", drawStop);
canvas.addEventListener("touchend", drawStop);


// NOVI FLOOD FILL
function floodFill(position, color) {
    let pixelStack = [{x: position.x, y: position.y}];
    let pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let linearCoordinates = (position.y * canvas.width + position.x) * 4;
    let originalColor = {
        r: pixels.data[linearCoordinates],
        g: pixels.data[linearCoordinates + 1],
        b: pixels.data[linearCoordinates + 2],
        a: 255
    };

    if (!(color[3] === 255)) {
        color[3] = 255;
    }

    if (originalColor.r === color[0] &&
        originalColor.g === color[1] &&
        originalColor.b === color[2])
    {
        console.log(`First pixel is matching, aborting floodFill`);
        return;
    }

    let newPixel;
    let x;
    let y;
    while (pixelStack.length > 0) {
        newPixel = pixelStack.shift();
        x = newPixel.x;
        y = newPixel.y;

        //console.log( x + ", " + y ) ;

        linearCoordinates = (y * canvas.width + x) * 4;
        while (y-- >= 0 &&
        (   pixels.data[linearCoordinates] == originalColor.r &&
            pixels.data[linearCoordinates + 1] == originalColor.g &&
            pixels.data[linearCoordinates + 2] == originalColor.b)) {
            linearCoordinates -= canvas.width * 4;
        }
        linearCoordinates += canvas.width * 4;
        y++;

        let reachedLeft = false;
        let reachedRight = false;
        while (y++ < canvas.height &&
        (   pixels.data[linearCoordinates] == originalColor.r &&
            pixels.data[linearCoordinates + 1] == originalColor.g &&
            pixels.data[linearCoordinates + 2] == originalColor.b))
        {
            pixels.data[linearCoordinates] = color[0];
            pixels.data[linearCoordinates + 1] = color[1];
            pixels.data[linearCoordinates + 2] = color[2];

            if (x > 0) {
                if (pixels.data[linearCoordinates - 4] == originalColor.r &&
                    pixels.data[linearCoordinates - 4 + 1] == originalColor.g &&
                    pixels.data[linearCoordinates - 4 + 2] == originalColor.b) {
                    if (!reachedLeft) {
                        // if(isInPixelStack(x - 1, y, pixelStack)){
                        //     pixelStack.push({x: x - 1, y: y});
                        //     reachedLeft = true;
                        // }
                        pixelStack.push({x: x - 1, y: y});
                        reachedLeft = true;
                    }
                } else if (reachedLeft) {
                    reachedLeft = false;
                }
            }

            if (x < canvas.width - 1) {
                if (pixels.data[linearCoordinates + 4] == originalColor.r &&
                    pixels.data[linearCoordinates + 4 + 1] == originalColor.g &&
                    pixels.data[linearCoordinates + 4 + 2] == originalColor.b) {
                    if (!reachedRight) {
                        // if(isInPixelStack(x + 1, y, pixelStack)) {
                        //     pixelStack.push({x: x + 1, y: y});
                        //     reachedRight = true;
                        // }
                        pixelStack.push({x: x + 1, y: y});
                        reachedRight = true;
                    }
                } else if (reachedRight) {
                    reachedRight = false;
                }
            }

            linearCoordinates += canvas.width * 4;
        }
    }
    context.putImageData( pixels, 0, 0 ) ;
}

function isInPixelStack( x, y, pixelStack ) {
    for(let i=0 ; i<pixelStack.length ; i++ ) {
        if( pixelStack[i].x==x && pixelStack[i].y==y ) {
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
// function stariFloodFill(position) {
//     const imageData = context.getImageData(0,0, canvas.width,canvas.height);
//     console.log(context.getImageData(0, 0, canvas.width, canvas.height));
//     const data = imageData.data;
//     const width = imageData.width;
//     const height = imageData.height;
//     // const stack = [[position.x, position.y]];
//     const stack = [[Math.floor(position.x), Math.floor(position.y)]];
//     const visited = new Set();
//     let pixelCount = 0;
//
//     let targetColor = getPixelColor(data, position.x, position.y);
//
//     //tretiramo transparentne tjst "neobojene" piksele kao bele
//     if (targetColor[3] === 0) {
//         targetColor[3] = 255;
//     }
//
//     if (colorsMatch(targetColor, selectedColor)) return;
//
//     while(stack.length > 0){
//         const [x,y] = stack.pop();
//         const cx = Math.floor(x);
//         const cy = Math.floor(y);
//
//         const key = `${cx},${cy}`;
//         if (visited.has(key)) continue;
//         visited.add(key);
//
//         // proveravamo granice canvasa
//         if(cx < 0 || cy < 0 || cx >= canvas.width || cy >= canvas.height) {
//             console.log(`Skipping out-of-bounds pixel at (${cx}, ${cy})`);
//             continue;
//         }
//
//         const currentColor = getPixelColor(data, cx, cy);
//         // console.log("Current:", currentColor, "Target:", targetColor);
//
//         //ova linija se preskace ukoliko nisu iste boje - samo nam je za exit kada se nadje ista boja
//         if (!colorsMatch(currentColor, targetColor)) {
//             continue;
//         }
//
//         // farbamo pixel
//         setPixelColor(data, cx, cy, selectedColor);
//
//         //dodajemo komsije
//         stack.push([cx - 1, cy]); //levo
//         stack.push([cx + 1, cy]); //desno
//         stack.push([cx, cy - 1]); //dole
//         stack.push([cx, cy + 1]); //gore
//
//         // Progress tracking (for large fills)
//         pixelCount++;
//         if (pixelCount % 1000 === 0) {
//             console.log(`Processed ${pixelCount} pixels...`);
//         }
//
//     }
//
//     // context.clearRect(0, 0, canvas.width, canvas.height);
//     context.putImageData(imageData, 0, 0);
// }

// function getPixelColor (data, x, y) {
//     const index = (y * canvas.width +x) *4;
//     const r = data[index];
//     const g = data[index + 1];
//     const b = data[index + 2];
//     const a = data[index + 3];
//
//     console.log(`Pixel at (${x}, ${y}):`, [r,g,b,a]);
//     if(a < 255) return [r,g,b,255];
//     return [r,g,b,a];
// }
//
// function setPixelColor (data, x, y, color) {
//     const index = (y * canvas.width + x) * 4;
//     const rgb = getRGB(selectedColor);
//     data[index] = rgb[0];     // Red
//     data[index + 1] = rgb[1]; // Green
//     data[index + 2] = rgb[2]; // Blue
//     data[index + 3] = 255;     // Alpha (fully opaque)
// }
//
// function colorsMatch(color1, color2) {
//     const match =
//         color1[0] === color2[0] &&
//         color1[1] === color2[1] &&
//         color1[2] === color2[2] &&
//         color1[3] === color2[3];
//
//     return match;
// }

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

// Image upload

function setupImageUploader() {
    const imageUploader = document.getElementById("imageUploader");

    imageUploader.addEventListener("change", (event) => {
        const file = event.target.files[0];

        if (file && file.type.startsWith("image/")) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const img = new Image();

                img.onload = function () {
                    // Resize canvas to match image dimensions
                    // canvas.width = img.width;
                    // canvas.height = img.height;

                    // Draw the image on the canvas
                    context.drawImage(img, 0, 0, img.width, img.height);
                    saveDrawingState();
                };

                img.src = e.target.result;
                // img.src = e.target.result.toString();
            };

            reader.readAsDataURL(file);
        } else {
            alert("Please upload a valid image file.");
        }
    });
}

//===========================
// NOVI SELECTION TOOL
//===========================

const overlay = document.getElementById("selectionCanvas");
const atakan = overlay.getContext("2d");

function syncOverlaySize() {
    const rect = canvas.getBoundingClientRect();
    overlay.width = rect.width;
    overlay.height = rect.height;
}

// Selection state
let selection = null;
let isDragging = null;
let isResizing = null;
let resizeHandle = null;

// Drag offsets
let dragOffsetX = null;
let dragOffsetY = null;

//clipboard famozni (inside joke)
let selectionClipboard = null;

// Resize pravougaonici velicina
const HANDLE_SIZE = 8;

// Pracenje pozicije misa na drfugom canvasu
let isMouseDown = false;
let startX = 0;
let startY = 0;

//===========================
// START SELECTION
//===========================
function startSelection(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    isMouseDown = true;
    startX = mx;
    startY = my;

    //ako postoji selekcija gledamo da li prevlacimo ili menjamo velicinu
    if(selection) {
        const handle = hitTestHandle(mx, my);
        if(handle) {
            isResizing = true;
            resizeHandle = handle;

            // Grab current image data and clear original rectangle
            selection.imageData = context.getImageData(
                selection.x,
                selection.y,
                selection.width,
                selection.height
            );
            clearSelectionArea(selection.x, selection.y, selection.width, selection.height);
            return;
        }

        if(insideSelection(mx, my)) {
            isDragging = true;
            dragOffsetX = mx - selection.x;
            dragOffsetY = my - selection.y;

            selection.imageData = context.getImageData(
                selection.x,
                selection.y,
                selection.width,
                selection.height
            );
            clearSelectionArea(selection.x, selection.y, selection.width, selection.height);
            return;
        }

        //ako kliknemo van selekcije onda ka uklanjamo
        selection = null;
        // deleteSelection();
        redrawOverlay();
        return;
    }

    //nova selekcija
    selection = {
        x: mx,
        y: my,
        width: 0,
        height: 0,
        imageData: null
    };
}

//===========================
// DRAW SELECTION - DRAGGING
//===========================
function updateSelection(e) {
    if(!isMouseDown || !selection) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if(isDragging) {
        selection.x = mx - dragOffsetX;
        selection.y = my - dragOffsetY;
        redrawOverlay();
        return;
    }

    if(isResizing) {
        resizeSelection(mx, my);
        redrawOverlay();
        return;
    }

    //pravljenje nove selekcije nakon pustanja
    selection.width = mx - startX;
    selection.height = my - startY;
    redrawOverlay();
}

//===========================
// END SELECTION - STOP
//===========================
function stopSelection() {
    if(!isMouseDown) return;
    isMouseDown = false;
    if(!selection) return;

    finalizeRect(selection);

    if(!selection.imageData) {
        selection.imageData = context.getImageData(
            selection.x,
            selection.y,
            selection.width,
            selection.height
        );
        clearSelectionArea(selection.x, selection.y, selection.width, selection.height);

    }
    // else if(!isDragging && !isResizing) {
    //     clearSelectionArea(selection.x, selection.y, selection.width, selection.height);
    // }

    if(selection.imageData) {
        const tmp = document.createElement("canvas");
        tmp.width = selection.imageData.width;
        tmp.height = selection.imageData.height;
        const tcontext = tmp.getContext("2d");
        tcontext.putImageData(selection.imageData, 0, 0);

        context.drawImage(
            tmp,
            selection.x,
            selection.y,
            selection.width,
            selection.height
        );

        selection.imageData = context.getImageData(
            selection.x,
            selection.y,
            selection.width,
            selection.height
        );
    }

    // context.putImageData(selection.imageData, selection.x, selection.y);

    isDragging = false;
    isResizing = false;
    redrawOverlay();
    saveDrawingState();
}

//===========================
// UTILS - razonoda
//===========================

function finalizeRect(selection) {
    if(selection.width < 0) {
        selection.x += selection.width;
        selection.width = Math.abs(selection.width);
    }
    if(selection.height < 0) {
        selection.y += selection.height;
        selection.height = Math.abs(selection.height);
    }
}

function insideSelection(x, y) {
    return(
        x >= selection.x &&
        x <= selection.x + selection.width &&
        y >= selection.y &&
        y <= selection.y + selection.height
    );
}

function clearSelectionArea(x, y, width, height) {
    context.clearRect(x, y, width, height);
    context.fillStyle = "#fff";
    context.fillRect(x, y, width, height);
}

function getHandles(selection) {
    return[
        {name: "topleft", x: selection.x, y: selection.y},
        {name: "topright", x: selection.x + selection.width, y: selection.y},
        {name: "bottomleft", x: selection.x, y: selection.y + selection.height},
        {name: "bottomright", x: selection.x + selection.width, y: selection.y + selection.height}
    ];
}

function hitTestHandle(x, y) {
    if(!selection) return null;

    for(const h of getHandles(selection)) {
        if(
            x >= h.x - HANDLE_SIZE &&
            x <= h.x + HANDLE_SIZE &&
            y >= h.y - HANDLE_SIZE &&
            y <= h.y + HANDLE_SIZE
        ) {
            return h.name;
        }
    }
    return null;
}

function resizeSelection(mx, my) {
    switch (resizeHandle) {
        case "topleft":
            selection.width += selection.x - mx;
            selection.x = mx;
            selection.height += selection.y - my;
            selection.y = my;
            break;
        case "topright":
            selection.height += selection.y - my;
            selection.y = my;
            selection.width = mx - selection.x;
            break;
        case "bottomleft":
            selection.width += selection.x - mx;
            selection.x = mx;
            selection.height = my - selection.y;
            break;
        case "bottomright":
            selection.width = mx - selection.x;
            selection.height = my - selection.y;
            break;
    }
}

//===========================
// CORE SPAJANJA CANVASA
//===========================

function redrawOverlay() {
    atakan.clearRect(0, 0, overlay.width, overlay.height);
    if(!selection) return;

    if((isDragging || isResizing) && selection.imageData) {
        const tmp = document.createElement("canvas");
        tmp.width = selection.imageData.width;
        tmp.height = selection.imageData.height;
        const tcontext = tmp.getContext("2d");
        tcontext.putImageData(selection.imageData, 0, 0);

        atakan.drawImage(
            tmp,
            selection.x,
            selection.y,
            selection.width,
            selection.height
        );
    }

    atakan.strokeStyle = "black";
    atakan.setLineDash([6, 4]);
    atakan.strokeRect(selection.x, selection.y, selection.width, selection.height);

    for(const h of getHandles(selection)) {
        atakan.fillStyle = "#fff";
        atakan.strokeStyle = "black";
        atakan.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
        atakan.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    }

    atakan.setLineDash([]);
}

//===========================
// COPY/PASTE/DELETE
//===========================

function copySelection() {
    if(!selection || !selection.imageData) return;

    const original = selection.imageData;
    selectionClipboard = new ImageData(
        new Uint8ClampedArray(original.data),
        original.width,
        original.height
    );
    console.log("Copied the selectioN!");
}

function pasteSelection() {
    if(!selectionClipboard) return;

    const x = 20;
    const y = 20;

    const tmp = document.createElement("canvas");
    tmp.width = selectionClipboard.width;
    tmp.height = selectionClipboard.height;
    const tcontext = tmp.getContext("2d");
    tcontext.putImageData(selectionClipboard, 0, 0);
    context.drawImage(tmp, x, y);

    selection = {
        x,
        y,
        width: selectionClipboard.width,
        height: selectionClipboard.height,
        imageData: context.getImageData(
            x,
            y,
            selectionClipboard.width,
            selectionClipboard.height
        )
    };

    redrawOverlay();
    saveDrawingState();
    console.log("Pasted the selection!");
}

function deleteSelection() {
    if(!selection) return;

    clearSelectionArea(selection.x, selection.y, selection.width, selection.height);
    selection = null;

    redrawOverlay();
    saveDrawingState(); //delete postane neopoziv
    console.log("Deleted the selection!");
}

//PRONADJENO NA NETU
// --- Keyboard Shortcuts ---
// Add this near the bottom of your script, after selection logic is initialized
window.addEventListener('keydown', (e) => {
    if(selectedTool !== 'select') return;

    // CTRL + C => Copy
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (selection && selection.imageData) {
            copySelection();
        }
        e.preventDefault();
    }
    // CTRL + V => Paste
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        if (selectionClipboard) { //napraviti clipboard nekako
            pasteSelection();
        }
        e.preventDefault();
    }
    // DELETE & BACKSPACE => Remove selection
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection) { //selection && selection.active
            deleteSelection();
        }
        e.preventDefault();
    }
    // ESC => Clear selection
    if (e.key === 'Escape') {
        if(selection) {
            selection = null;
            redrawOverlay();
            console.log('Selection is cancelled!');
        }
        e.preventDefault();
    }
});













