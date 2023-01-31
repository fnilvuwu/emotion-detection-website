const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasRoi = document.getElementById('canvas_roi');
const canvasCtx = canvasElement.getContext('2d');
const roiCtx = canvasRoi.getContext('2d');
const drawingUtils = window;
const emotions = ["Marah", "Senang", "Sedih", "Kaget"];
let tfliteModel = undefined;

async function start() {
    await tf.loadLayersModel(
        "/static/model/uint8/model.json"
    ).then((loadedModel) => {
        tfliteModel = loadedModel;
    });
}

start();

function openCvReady() {
    cv['onRuntimeInitialized'] = () => {
        function onResults(results) {
            // Draw the overlays.
            canvasCtx.save();
            roiCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            roiCtx.clearRect(0, 0, canvasRoi.width, canvasRoi.height);
            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            if (results.detections.length > 0) {
                drawingUtils.drawRectangle(
                    canvasCtx, results.detections[0].boundingBox,
                    { color: 'blue', lineWidth: 4, fillColor: '#00000000' });
                let width = results.detections[0].boundingBox.width * canvasElement.width;
                let height = results.detections[0].boundingBox.height * canvasElement.height;
                let sx = results.detections[0].boundingBox.xCenter * canvasElement.width - (width / 2);
                let sy = results.detections[0].boundingBox.yCenter * canvasElement.height - (height / 2);
                let center = sx + (width / 2);
                
                let imgData = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
                let gray_roi = cv.matFromImageData(imgData);
                let rect = new cv.Rect(sx, sy, width, height);
                gray_roi = gray_roi.roi(rect);

                cv.cvtColor(gray_roi, gray_roi, cv.COLOR_RGBA2GRAY, 0);
                cv.imshow('canvas_roi', gray_roi);
                //issue are image is not grayscale, predict input is wrong
                const outputTensor = tf.tidy(() => {
                    // Transform the image data into Array pixels.
                    let img = tf.browser.fromPixels(canvasRoi);

                    // Resize, normalize, expand dimensions of image pixels by 0 axis.:
                    img = tf.image.resizeBilinear(img, [48, 48]);
                    img = tf.div(tf.expandDims(img, 0), 255);

                    // Predict the emotions.
                    let outputTensor = tfliteModel.predict(img).arraySync();
                    return outputTensor;
                });
                // Convert to array and take prediction index with highest value
                let index = outputTensor[0].indexOf(Math.max(...outputTensor[0]));
                console.log(index)

                canvasCtx.font = "100px Arial";
                canvasCtx.fillStyle = "red";
                canvasCtx.textAlign = "center";

                canvasCtx.fillText(emotions[index], center, sy - 10);
            }

            canvasCtx.restore();
            roiCtx.restore();
        }

        const faceDetection = new FaceDetection({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
            }
        });

        faceDetection.setOptions({
            selfieMode: true,
            model: 'short',
            minDetectionConfidence: 0.5
        });

        faceDetection.onResults(onResults);

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await faceDetection.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });
        camera.start();
    }
}
