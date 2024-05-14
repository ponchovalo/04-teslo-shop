import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Get, Param, Res } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from 'src/common/helpers/fileFilter.helpers';
import { diskStorage } from 'multer';
import { fileNamer } from 'src/common/helpers/fileNamer.helpers';
import { Response } from 'express'
import { ConfigService } from '@nestjs/config';
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly configService: ConfigService
  ) {}


  @Get('product/:imageName')
  findProductImage(
    @Res() res: Response,
    @Param('imageName') imageName: string) {
    const path = this.filesService.getStaticproductIamage(imageName)
    res.sendFile(path)
  }

  @Post('product')
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: fileFilter,
    //limits: {fileSize:1000}
    storage: diskStorage({
      destination: './static/products',
      filename: fileNamer
    })
  }))
  uploadProductImage( @UploadedFile() file: Express.Multer.File ){

    if(!file){
      throw new BadRequestException(`Make sure the file is an image`)
    }

    const secureUrl = `${this.configService.get('HOST_API')}/files/product/${file.filename}`
    return {secureUrl}
  }

}
