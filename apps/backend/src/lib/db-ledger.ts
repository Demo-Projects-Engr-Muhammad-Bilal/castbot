import { prisma } from "./prisma";
import { PublishJob, PublishTask, PublishStatus, Provider } from "@repo/database";

/**
 * Creates the parent PublishJob record with status PENDING for immediate or scheduled posts,
 * looking up tenant accounts to satisfy PostgreSQL XOR check constraint (publish_tasks_exactly_one_target).
 */
export async function createPendingPublishJob(
  tenantId: string,
  videoUrl: string,
  caption?: string,
  platforms: (Provider | string)[] = []
): Promise<PublishJob> {
  console.log(`📝 Creating PENDING PublishJob for tenant ${tenantId}... Requested platforms:`, platforms);

  const taskDataList = [];

  try {
    const [accounts, telegramConns] = await Promise.all([
      prisma.socialAccount.findMany({ where: { tenantId } }),
      prisma.telegramConnection.findMany({ where: { tenantId } }),
    ]);

    // Expand META into FACEBOOK and/or INSTAGRAM
    const targetProviders: Provider[] = [];
    for (const p of platforms) {
      const pUpper = String(p).toUpperCase();
      if (pUpper === "META") {
        const fbAccount = accounts.find((a) => a.provider === Provider.FACEBOOK);
        const igAccount = accounts.find((a) => a.provider === Provider.INSTAGRAM);

        if (fbAccount) targetProviders.push(Provider.FACEBOOK);
        if (igAccount) targetProviders.push(Provider.INSTAGRAM);
        if (!fbAccount && !igAccount) {
          targetProviders.push(Provider.FACEBOOK);
          targetProviders.push(Provider.INSTAGRAM);
        }
      } else if (pUpper === "YOUTUBE") {
        targetProviders.push(Provider.YOUTUBE);
      } else if (pUpper === "TIKTOK") {
        targetProviders.push(Provider.TIKTOK);
      } else if (pUpper === "TELEGRAM") {
        targetProviders.push(Provider.TELEGRAM);
      } else if (pUpper === "FACEBOOK") {
        targetProviders.push(Provider.FACEBOOK);
      } else if (pUpper === "INSTAGRAM") {
        targetProviders.push(Provider.INSTAGRAM);
      }
    }

    for (const provider of targetProviders) {
      if (provider === Provider.TELEGRAM) {
        const tgConn = telegramConns[0];
        taskDataList.push({
          platform: provider,
          status: PublishStatus.PENDING,
          telegramConnectionId: tgConn?.id || null,
        });
      } else {
        const sa = accounts.find((a) => a.provider === provider);
        taskDataList.push({
          platform: provider,
          status: PublishStatus.PENDING,
          socialAccountId: sa?.id || null,
        });
      }
    }
  } catch (lookupErr) {
    console.warn("⚠️ [Ledger] Account resolution warning during pending job creation:", lookupErr);
  }

  return await prisma.publishJob.create({
    data: {
      tenantId,
      videoUrl: videoUrl || "",
      caption: caption || null,
      status: PublishStatus.PENDING,
      tasks: taskDataList.length > 0 ? { create: taskDataList } : undefined,
    },
    include: { tasks: true },
  });
}

/**
 * Creates the parent PublishJob record with status PROCESSING.
 */
export async function createPublishJob(
  tenantId: string,
  videoUrl: string,
  caption?: string
): Promise<PublishJob> {
  console.log(`📝 Creating PublishJob for tenant ${tenantId}...`);
  return await prisma.publishJob.create({
    data: {
      tenantId,
      videoUrl,
      caption: caption || null,
      status: PublishStatus.PROCESSING,
    },
  });
}

/**
 * Upserts a child PublishTask record tracking individual platform upload progress.
 */
export async function upsertPublishTask(
  jobId: string,
  platform: Provider,
  status: PublishStatus,
  externalId?: string,
  errorLog?: string,
  socialAccountId?: string,
  telegramConnectionId?: string
): Promise<PublishTask> {
  console.log(`📝 Logging platform task [${platform}] status [${status}] for job ${jobId}...`);
  const existingTask = await prisma.publishTask.findFirst({
    where: { jobId, platform },
  });

  if (existingTask) {
    return await prisma.publishTask.update({
      where: { id: existingTask.id },
      data: {
        status,
        externalId: externalId !== undefined ? externalId : existingTask.externalId,
        errorLog: errorLog !== undefined ? errorLog : existingTask.errorLog,
        socialAccountId: socialAccountId || existingTask.socialAccountId,
        telegramConnectionId: telegramConnectionId || existingTask.telegramConnectionId,
      },
    });
  }

  return await prisma.publishTask.create({
    data: {
      jobId,
      platform,
      status,
      externalId: externalId || null,
      errorLog: errorLog || null,
      socialAccountId: socialAccountId || null,
      telegramConnectionId: telegramConnectionId || null,
    },
  });
}

/**
 * Updates the overall status of the parent PublishJob record.
 */
export async function updatePublishJobStatus(
  jobId: string,
  status: PublishStatus
): Promise<PublishJob> {
  console.log(`📝 Updating PublishJob [${jobId}] overall status to [${status}]...`);
  return await prisma.publishJob.update({
    where: { id: jobId },
    data: { status },
  });
}

/**
 * Reports whether every PublishTask child of a job has reached a terminal
 * state (COMPLETED or FAILED). Used to coordinate finalizing the parent
 * PublishJob's overall status when its platform tasks are processed by
 * multiple independent queues/workers (e.g. the isolated TikTok queue).
 */
export async function getJobTaskCompletionState(
  jobId: string
): Promise<{ allTerminal: boolean; hasFailures: boolean; taskCount: number }> {
  const tasks = await prisma.publishTask.findMany({
    where: { jobId },
    select: { status: true },
  });

  const allTerminal =
    tasks.length > 0 &&
    tasks.every((t) => t.status === PublishStatus.COMPLETED || t.status === PublishStatus.FAILED);
  const hasFailures = tasks.some((t) => t.status === PublishStatus.FAILED);

  return { allTerminal, hasFailures, taskCount: tasks.length };
}

/**
 * Legacy helper maintained for backward compatibility with existing callers.
 */
export async function logCloudinaryAssetToLedger(
  tenantSlug: string,
  secureUrl: string,
  title: string
): Promise<PublishJob> {
  console.log(`📝 Querying tenant database record for slug: ${tenantSlug}`);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    throw new Error(`❌ Tenant not found in database with slug: ${tenantSlug}`);
  }

  console.log("💾 Creating PublishJob parent record into ledger...");
  return createPublishJob(tenant.id, secureUrl, title);
}

/**
 * Legacy helper maintained for backward compatibility.
 */
export async function logPlatformJobStatus(
  jobIdOrTenantId: string,
  platform: Provider,
  videoUrl: string,
  caption: string,
  status: PublishStatus,
  errorLog?: string,
  socialAccountId?: string
): Promise<PublishTask> {
  return upsertPublishTask(
    jobIdOrTenantId,
    platform,
    status,
    undefined,
    errorLog,
 socialAccountId
  );
}
