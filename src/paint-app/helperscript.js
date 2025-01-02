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
let selectedColor = "#000";
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
    let r = Math.sqrt(Math.pow((prevMousePoint.x - position.x), 2) + Math.pow((prevMousePoint.y - position.y)), 2);
    context.arc(prevMousePoint.x, prevMousePoint.y, r, 0, 2* Math.PI);

    fillShapeCheckbox.checked ? context.fill() : context.stroke();
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
    } else {
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
