import 'dotenv/config';
import { join } from 'path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const prod = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  // API + Meta OAuth HTML. Default CSP/COOP/CORP blocks Facebook login in WebView.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(firstHint(errors)),
    }),
  );

  if (!prod) {
    const config = new DocumentBuilder()
      .setTitle('Againo API')
      .setDescription(
        [
          'Owner: register → verify email → onboarding (company name + type).',
          'Members and staff are created inside the gym/shop, not on public signup.',
          'Authorize with accessToken from login.',
        ].join('\n\n'),
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )
      .build();

    SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config), {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

function firstHint(errors: ValidationError[]): string {
  for (const e of errors) {
    const hit = e.constraints ? Object.values(e.constraints)[0] : undefined;
    if (hit) return hit;
    if (e.children?.length) {
      const nested = firstHint(e.children);
      if (nested) return nested;
    }
  }
  return 'Check the form and try again.';
}
