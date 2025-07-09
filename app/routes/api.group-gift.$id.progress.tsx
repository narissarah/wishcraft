import { LoaderFunctionArgs, json } from "@remix-run/node";
import { getGroupGiftProgress } from "~/lib/group-gifting.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;
  
  if (!id) {
    return json({ error: "Group gift ID required" }, { status: 400 });
  }

  try {
    const progress = await getGroupGiftProgress(id);
    
    return json({
      progress: {
        currentAmount: progress.currentAmount,
        targetAmount: progress.targetAmount,
        contributorCount: progress.contributions.length,
        status: progress.status,
        deadline: progress.deadline,
        progressPercentage: progress.progressPercentage,
        remainingAmount: progress.remainingAmount,
        daysRemaining: progress.daysRemaining,
        isCompleted: progress.isCompleted,
        isExpired: progress.isExpired,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    return json({ error: "Failed to get progress" }, { status: 500 });
  }
}