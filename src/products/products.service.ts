import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, Query } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';
import { ProductImage } from './entities';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource
  ){}

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto;

      const product = this.productRepository.create({
        ...productDetails,
        images: images.map(image => this.productImageRepository.create({url: image}))
      })
      await this.productRepository.save(product)
      return ({...product, images}); 
    } catch (error) {
      this.handleDBException(error)
    }
  }

  async findAll(paginatioDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginatioDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: {
        images: true
      }
    });

    return products.map(product => ({
      ...product,
      images: product.images.map(img => img.url)
    }))
  }

  async findOne(term: string) {
    let product: Product;
    if( isUUID(term) ){
      product = await this.productRepository.findOneBy({id: term})
    }else {
      //product = await this.productRepository.findOneBy({slug: term})
      const queryBuilder = this.productRepository.createQueryBuilder('prod')
      product = await queryBuilder
        .where('UPPER(title) =:title or slug =:slug', {
          title: term.toLocaleUpperCase(),
          slug: term.toLocaleLowerCase()
        })
        .leftJoinAndSelect('prod.images', 'prodImages') 
        .getOne()
    }
    if(!product) throw new NotFoundException(`No se encontro el producto con id ${term}`)
    return product
  }

  async findOnePlain(term: string){
    const { images = [], ...rest} = await this.findOne(term);

    return {
      ...rest,
      images: images.map(image => image.url)
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    //Separamos las imagenes con las desestructuracion
    const {images, ...toUpdate} = updateProductDto;
    //Hacemos un preload con todo lo demas excepto las imagenes
    const product = await this.productRepository.preload({ id, ...toUpdate });
    //Hacemos la validacion de la existencia o no del producto a editar
    if(!product) throw new NotFoundException(`Product with id ${id} not found`)
    // Create query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      if( images ) {
        await queryRunner.manager.delete(ProductImage, { product: { id } })
        product.images = images.map(image => this.productImageRepository.create({url: image}))
      }

      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction()
      await queryRunner.release()
     
      //await this.productRepository.save(product)
      return this.findOnePlain(id)

    } catch (error) {
      await queryRunner.rollbackTransaction(),
      await queryRunner.release()
      this.handleDBException(error)
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  private handleDBException(error: any){
    if(error.code ==='23505') throw new BadRequestException(error.detail);
    this.logger.error(error)
    throw new InternalServerErrorException('Unexpected server errors, check logs server')
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('product')
    try {
      return await query.delete().where({}).execute()
    } catch (error) {
      this.handleDBException(error)
    }
  }


}
