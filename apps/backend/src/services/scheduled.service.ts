import { prisma } from "../lib/prisma";
import { publishQueue } from "../queues/publish.queue";
import { PublishStatus } from "@repo/database";
import { NotFoundError, ValidationError } from "../errors/app-error";

/** Lists all PENDING publish jobs for a tenant, cross-referenced with BullMQ delayed jobs. */
export async function listScheduledJobs(tenantId: string) {
  const scheduledJobs = await prisma.publishJob.findMany({
    where: { tenantId, status: PublishStatus.PENDING },
    include: {
      tasks: {
        include: { socialAccount: true, telegramConnection: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const delayedJobsInQueue = await publishQueue.getDelayed();

  return Promise.all(
    scheduledJobs.map(async (job) => {
      const queueJob = delayedJobsInQueue.find((qj) => qj.opts?.jobId === job.id || qj.id === job.id);
      const jobDelay = queueJob?.opts?.delay || 0;
      const delayMs = queueJob ? Math.max(0, queueJob.timestamp + jobDelay - Date.now()) : 0;
      const scheduledTime = queueJob ? new Date(queueJob.timestamp + jobDelay).toISOString() : null;

      return {
        id: job.id,
        videoUrl: job.videoUrl,
        caption: job.caption,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        scheduledFor: scheduledTime,
        delayMs,
        tasks: job.tasks,
        queueJobId: queueJob?.id || null,
      };
    })
  );
}

/** Retrieves a single PublishJob by ID for a tenant with all platformTasks included. */
export async function getScheduledJobById(tenantId: string, jobId: string) {
  const job = await prisma.publishJob.findFirst({
    where: { id: jobId, tenantId },
    include: {
      tasks: {
        include: { socialAccount: true, telegramConnection: true },
      },
    },
  });

  if (!job) {
    throw new NotFoundError("Publish job not found.");
  }

  return {
    id: job.id,
    videoUrl: job.videoUrl,
    caption: job.caption,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    tasks: job.tasks.map((t) => ({
      id: t.id,
      platform: t.platform,
      provider: t.platform,
      status: t.status,
      postUrl: (t as any).postUrl || (t as any).publishedUrl || (t as any).assetUrl || null,
      errorMessage: (t as any).errorMessage || (t as any).errorLog || null,
      externalId: (t as any).externalId || (t as any).postId || null,
      updatedAt: t.updatedAt,
    })),
  };
}

export interface UpdateScheduledJobInput {
  scheduledFor?: string | number;
  caption?: string;
  platforms?: string[];
}

/** Reschedules and/or updates the caption/platforms of a pending, tenant-owned job. */
export async function updateScheduledJob(tenantId: string, jobId: string, input: UpdateScheduledJobInput) {
  const { scheduledFor, caption, platforms } = input;

  const existingJob = await prisma.publishJob.findFirst({
    where: { id: jobId, tenantId },
    include: { tasks: true },
  });

  if (!existingJob) {
    throw new NotFoundError("Scheduled job not found.");
  }

  let delay = 0;
  if (scheduledFor) {
    const newScheduledTime = new Date(scheduledFor).getTime();
    const now = Date.now();

    if (isNaN(newScheduledTime)) {
      throw new ValidationError("Invalid scheduled date/time format.");
    }

    delay = newScheduledTime - now;
    if (delay < 30000) {
      throw new ValidationError("Scheduled time must be at least 1 minute in the future.");
    }
  }

  const bullJob = await publishQueue.getJob(jobId);

  if (bullJob) {
    const currentData = bullJob.data;
    const updatedData = {
      ...currentData,
      caption: caption !== undefined ? caption : currentData.caption,
      platforms: platforms !== undefined ? platforms : currentData.platforms,
    };

    await bullJob.remove();

    await publishQueue.add("publish-video", updatedData, {
      jobId,
      delay: delay > 0 ? delay : bullJob.opts?.delay,
    });
  }

  return prisma.publishJob.update({
    where: { id: jobId },
    data: { caption: caption !== undefined ? caption : existingJob.caption },
    include: { tasks: true },
  });
}

/** Cancels a pending, tenant-owned scheduled job (removes from BullMQ, marks FAILED). */
export async function cancelScheduledJob(tenantId: string, jobId: string) {
  const existingJob = await prisma.publishJob.findFirst({ where: { id: jobId, tenantId } });

  if (!existingJob) {
    throw new NotFoundError("Scheduled job not found.");
  }

  const bullJob = await publishQueue.getJob(jobId);
  if (bullJob) {
    await bullJob.remove();
  }

  return prisma.publishJob.update({
    where: { id: jobId },
    data: { status: PublishStatus.FAILED },
  });
}
