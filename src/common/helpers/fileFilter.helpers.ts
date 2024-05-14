

export const fileFilter = (req: Express.Request, file: Express.Multer.File, callback: Function ) => {

    console.log({file})
    // Validamos si el archivo viene
    if(!file) return callback(new Error('File is Empty'), false);
    
    //Validamos la extension del archivo
    const fileExtension = file.mimetype.split('/')[1];
    const validExtension = ['jpg', 'jpeg', 'png', 'gif'];

    if(validExtension.includes(fileExtension)) {
        return callback(null, true)
    }

    callback(null, false)
}