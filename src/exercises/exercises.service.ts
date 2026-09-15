import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCatalogOne, listBodyParts, listCatalog, sourceKeys, thumbOf } from './catalog.client';
import { joinInstructions, mapMuscleGroup } from './catalog.map';
import { CatalogQueryDto, ImportCatalogDto, UpsertExerciseDto } from './dto/exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  list(gymId: number) {
    return this.prisma.exercise.findMany({
      where: { gymId },
      orderBy: { name: 'asc' },
    });
  }

  async get(gymId: number, id: number) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id, gymId },
    });
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }
    return exercise;
  }

  create(gymId: number, dto: UpsertExerciseDto) {
    return this.prisma.exercise.create({ data: { ...dto, gymId } });
  }

  async update(gymId: number, id: number, dto: UpsertExerciseDto) {
    await this.get(gymId, id);
    return this.prisma.exercise.update({ where: { id }, data: dto });
  }

  async catalog(gymId: number, query: CatalogQueryDto) {
    try {
      const [page, owned] = await Promise.all([
        listCatalog({
          search: query.search,
          bodyPart: query.bodyPart,
          after: query.after,
          limit: 36,
        }),
        this.prisma.exercise.findMany({
          where: { gymId },
          select: { sourceId: true, name: true },
        }),
      ]);
      const ownedIds = new Set(
        owned.flatMap((e) => sourceKeys(e.sourceId)),
      );
      const ownedNames = new Set(
        owned.map((e) => e.name.trim().toLowerCase()).filter(Boolean),
      );
      return {
        nextCursor: page.meta?.nextCursor ?? null,
        hasNextPage: !!page.meta?.hasNextPage,
        items: (page.data ?? []).map((e: any) => {
          const keys = sourceKeys(e.exerciseId);
          const inLibrary =
            keys.some((k) => ownedIds.has(k)) ||
            ownedNames.has(String(e.name ?? '').trim().toLowerCase());
          return {
            sourceId: String(e.exerciseId),
            name: e.name,
            imageUrl: thumbOf(e),
            videoUrl: e.videoUrl ?? null,
            muscleGroup: mapMuscleGroup(e.bodyParts, e.targetMuscles),
            equipment: e.equipments?.[0] ?? null,
            inLibrary,
          };
        }),
      };
    } catch {
      throw new BadGatewayException('Exercise catalog is unavailable. Try again in a moment.');
    }
  }

  async catalogBodyParts() {
    try {
      const res = await listBodyParts();
      return res.data ?? [];
    } catch {
      throw new BadGatewayException('Exercise catalog is unavailable. Try again in a moment.');
    }
  }

  async importFromCatalog(gymId: number, dto: ImportCatalogDto) {
    let raw;
    try {
      raw = await getCatalogOne(String(dto.sourceId));
    } catch {
      throw new BadGatewayException('Exercise catalog is unavailable. Try again in a moment.');
    }
    const src = raw?.data;
    if (!src?.exerciseId) throw new NotFoundException('Catalog exercise not found');

    const keys = sourceKeys(src.exerciseId);
    const already = await this.prisma.exercise.findFirst({
      where: {
        gymId,
        OR: [
          { sourceId: { in: keys } },
          { name: { equals: src.name, mode: 'insensitive' } },
        ],
      },
    });
    if (already) {
      throw new ConflictException('Already in your gym library');
    }

    const data = {
      gymId,
      sourceId: src.exerciseId,
      name: src.name,
      imageUrl: thumbOf(src),
      videoUrl: src.videoUrl ?? null,
      muscleGroup: mapMuscleGroup(src.bodyParts, src.targetMuscles),
      instructions: joinInstructions(src.instructions),
      description: src.equipments?.length ? src.equipments.join(', ') : undefined,
      defaultSets: dto.defaultSets ?? 3,
      defaultReps: dto.defaultReps ?? 10,
      defaultRestSeconds: dto.defaultRestSeconds ?? 60,
    };

    try {
      return await this.prisma.exercise.create({ data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Already in your gym library');
      }
      throw e;
    }
  }

  async remove(gymId: number, id: number) {
    await this.get(gymId, id);
    const [logged, extras] = await Promise.all([
      this.prisma.workoutSet.count({
        where: { programmeExercise: { exerciseId: id } },
      }),
      this.prisma.workoutExtraSet.count({ where: { exerciseId: id } }),
    ]);
    if (logged || extras) {
      throw new ConflictException(
        'Used in workout history. Cannot remove from library.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.programmeExercise.deleteMany({ where: { exerciseId: id } }),
      this.prisma.exercise.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
