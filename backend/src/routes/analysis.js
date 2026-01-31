const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const CategoryCache = require('../models/CategoryCache');
const AISummaryUsage = require('../models/AISummaryUsage');
const { categorizeExpense, getCacheStats, CATEGORIES } = require('../utils/expenseCategories');

/**
 * GET /api/analysis
 * Get analysis data for the authenticated user
 * 
 * This endpoint:
 * 1. First checks the current date
 * 2. If any months are stale (>6 months old), removes their values from category rows
 * 3. Returns the cleaned, current 6-month data
 */
router.get('/', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
    const analysis = await Analysis.findOrCreateByMailId(mailId);
    
    // Check for stale months before cleanup (for logging)
    const beforeCheck = analysis.checkForStaleMonths();
    
    // Ensure months are current - this removes stale data
    analysis.ensureCurrentMonths();
    
    // Save if data was modified (stale months removed)
    if (analysis._staleDataRemoved || beforeCheck.hasStale) {
      await analysis.save();
      console.log(`📊 Analysis [${mailId}]: Saved after removing stale months`);
    }
    
    res.json({
      success: true,
      data: analysis.toJSON(),
      staleRemoved: beforeCheck.hasStale,
      staleMonthsRemoved: beforeCheck.staleMonths
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analysis/categories
 * Get list of available categories
 */
router.get('/categories', async (req, res) => {
  res.json({
    success: true,
    data: CATEGORIES
  });
});

/**
 * GET /api/analysis/check-stale
 * Check if user's analysis data has any stale months (for debugging/monitoring)
 */
router.get('/check-stale', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
    const analysis = await Analysis.findOrCreateByMailId(mailId);
    const staleCheck = analysis.checkForStaleMonths();
    const data = analysis.getData();
    
    res.json({
      success: true,
      data: {
        mailId,
        currentDataMonths: data.months,
        hasStaleMonths: staleCheck.hasStale,
        staleMonths: staleCheck.staleMonths,
        validMonths: staleCheck.currentMonths,
        expectedCurrentMonth: Analysis.getCurrentMonth(),
        message: staleCheck.hasStale 
          ? `Found ${staleCheck.staleMonths.length} stale month(s) that will be removed on next query`
          : 'All months are within the 6-month window'
      }
    });
  } catch (error) {
    console.error('Error checking stale months:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analysis/categorize
 * Categorize an expense title (for testing/preview)
 */
router.post('/categorize', async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Expense title is required'
      });
    }
    
    const category = await categorizeExpense(title);
    
    res.json({
      success: true,
      data: {
        title,
        category
      }
    });
  } catch (error) {
    console.error('Error categorizing expense:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analysis/summary
 * Get summarized analysis with totals by category and month
 * 
 * This endpoint:
 * 1. Checks current date and removes stale months (>6 months old)
 * 2. Returns cleaned data with totals and percentages
 */
router.get('/summary', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
    const analysis = await Analysis.findOrCreateByMailId(mailId);
    
    // Check for stale months before cleanup
    const beforeCheck = analysis.checkForStaleMonths();
    
    // Ensure months are current - removes stale data
    analysis.ensureCurrentMonths();
    
    // Always save after ensuring current months (in case stale data was removed)
    if (analysis._staleDataRemoved || beforeCheck.hasStale) {
      await analysis.save();
    }
    
    const data = analysis.getData();
    
    // Calculate totals
    const categoryTotals = {};
    const monthTotals = new Array(6).fill(0);
    let grandTotal = 0;
    
    CATEGORIES.forEach(cat => {
      categoryTotals[cat] = data.categories[cat].reduce((sum, val) => sum + val, 0);
      grandTotal += categoryTotals[cat];
      
      data.categories[cat].forEach((amount, idx) => {
        monthTotals[idx] += amount;
      });
    });
    
    // Calculate percentages
    const categoryPercentages = {};
    CATEGORIES.forEach(cat => {
      categoryPercentages[cat] = grandTotal > 0 
        ? Math.round((categoryTotals[cat] / grandTotal) * 100) 
        : 0;
    });
    
    res.json({
      success: true,
      data: {
        mailId: analysis._id,
        months: data.months,
        categories: data.categories,
        categoryTotals,
        categoryPercentages,
        monthTotals,
        grandTotal: Math.round(grandTotal * 100) / 100,
        updatedAt: analysis.updatedAt,
        staleRemoved: beforeCheck.hasStale,
        staleMonthsRemoved: beforeCheck.staleMonths
      }
    });
  } catch (error) {
    console.error('Error fetching analysis summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analysis/reset
 * Reset analysis data for the authenticated user (for testing)
 */
router.post('/reset', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
    // Delete existing analysis
    await Analysis.deleteOne({ _id: mailId.toLowerCase().trim() });
    
    // Create fresh analysis
    const analysis = await Analysis.findOrCreateByMailId(mailId);
    
    res.json({
      success: true,
      message: 'Analysis data reset successfully',
      data: analysis.toJSON()
    });
  } catch (error) {
    console.error('Error resetting analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analysis/cache-stats
 * Get category cache statistics (for monitoring)
 */
router.get('/cache-stats', async (req, res) => {
  try {
    const stats = await getCacheStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analysis/user-data
 * Get complete analysis data for the user (for Expense Insights and Analysis sections)
 * 
 * Returns:
 * - months: Array of month strings ["2026-01", "2025-12", ...]
 * - monthlyData: Array of monthly breakdowns with categories, totals, percentages
 * - categoryTotals: Total amounts per category across all months
 * - grandTotal: Total across all categories and months
 */
router.get('/user-data', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
    const analysis = await Analysis.findOrCreateByMailId(mailId);
    
    // Ensure months are current
    analysis.ensureCurrentMonths();
    if (analysis._staleDataRemoved) {
      await analysis.save();
    }
    
    const data = analysis.getData();
    
    // Build monthly data with categories for each month
    const monthlyData = data.months.map((month, monthIndex) => {
      let monthTotal = 0;
      
      // Get amounts for each category in this month
      const categoryAmounts = CATEGORIES.map(cat => {
        const amount = data.categories[cat][monthIndex] || 0;
        monthTotal += amount;
        return {
          name: cat,
          amount: Math.round(amount * 100) / 100,
          color: getCategoryColor(cat)
        };
      });
      
      // Calculate percentages for this month
      const categories = categoryAmounts.map(cat => ({
        ...cat,
        percentage: monthTotal > 0 ? Math.round((cat.amount / monthTotal) * 100) : 0
      }));
      
      // Get month label (e.g., "January 2026")
      const [year, monthNum] = month.split('-');
      const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const shortLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      return {
        month,
        monthLabel,
        shortLabel,
        categories,
        total: Math.round(monthTotal * 100) / 100
      };
    });
    
    // Calculate category totals across all months
    const categoryTotals = {};
    let grandTotal = 0;
    
    CATEGORIES.forEach(cat => {
      const total = data.categories[cat].reduce((sum, val) => sum + (val || 0), 0);
      categoryTotals[cat] = {
        amount: Math.round(total * 100) / 100,
        color: getCategoryColor(cat)
      };
      grandTotal += total;
    });
    
    // Calculate percentages for category totals
    CATEGORIES.forEach(cat => {
      categoryTotals[cat].percentage = grandTotal > 0 
        ? Math.round((categoryTotals[cat].amount / grandTotal) * 100) 
        : 0;
    });
    
    res.json({
      success: true,
      data: {
        mailId,
        months: data.months,
        monthlyData,
        categoryTotals,
        grandTotal: Math.round(grandTotal * 100) / 100,
        updatedAt: analysis.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching user analysis data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to get category color
 */
function getCategoryColor(category) {
  const colors = {
    food: '#FF6B35',
    travel: '#4CAF50',
    entertainment: '#2196F3',
    shopping: '#9C27B0',
    others: '#607D8B'
  };
  return colors[category] || '#607D8B';
}

/**
 * GET /api/analysis/ai-summary/usage
 * Get AI summary usage stats for the user
 */
router.get('/ai-summary/usage', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    const usage = await AISummaryUsage.getUsageStats(mailId);
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error fetching AI summary usage:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analysis/ai-summary
 * Generate AI-powered spending summary
 * Limited to 2 calls per user per day
 */
router.post('/ai-summary', async (req, res) => {
  try {
    const mailId = req.user.mailId;
    
    // Check rate limit
    const canCall = await AISummaryUsage.canMakeCall(mailId);
    if (!canCall.canCall) {
      return res.status(429).json({
        success: false,
        error: 'Daily limit reached',
        message: `You have used all ${canCall.limit} AI summaries for today. Try again tomorrow.`,
        usage: canCall
      });
    }
    
    // Get user's analysis data
    const analysis = await Analysis.findOrCreateByMailId(mailId);
    analysis.ensureCurrentMonths();
    if (analysis._staleDataRemoved) {
      await analysis.save();
    }
    
    const data = analysis.getData();
    
    // Calculate totals for each month and category
    const monthlyData = data.months.map((month, idx) => {
      const [year, monthNum] = month.split('-');
      const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      const categoryBreakdown = {};
      let total = 0;
      
      CATEGORIES.forEach(cat => {
        const amount = data.categories[cat][idx] || 0;
        categoryBreakdown[cat] = amount;
        total += amount;
      });
      
      return {
        month: monthName,
        total,
        breakdown: categoryBreakdown
      };
    });
    
    // Calculate overall totals
    const categoryTotals = {};
    let grandTotal = 0;
    CATEGORIES.forEach(cat => {
      categoryTotals[cat] = data.categories[cat].reduce((sum, val) => sum + (val || 0), 0);
      grandTotal += categoryTotals[cat];
    });
    
    // Check if user has any spending data
    if (grandTotal === 0) {
      return res.json({
        success: true,
        data: {
          summary: [
            "No spending data available yet.",
            "Start tracking your expenses to get personalized insights.",
            "Add expenses through your groups to see patterns emerge."
          ],
          hasData: false
        },
        usage: canCall
      });
    }
    
    // Generate AI summary
    const summaryResult = await generateAISummary(monthlyData, categoryTotals, grandTotal);
    
    // Record the API call
    const usageResult = await AISummaryUsage.recordCall(mailId);
    
    res.json({
      success: true,
      data: {
        summary: summaryResult.points,
        source: summaryResult.source, // 'ai' or 'fallback'
        hasData: true,
        generatedAt: new Date().toISOString()
      },
      usage: {
        remaining: usageResult.remaining,
        used: usageResult.used,
        limit: usageResult.limit
      }
    });
  } catch (error) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate AI summary using Gemini
 */
async function generateAISummary(monthlyData, categoryTotals, grandTotal) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('Gemini API key not configured, returning fallback summary');
    return {
      points: generateFallbackSummary(monthlyData, categoryTotals, grandTotal),
      source: 'fallback'
    };
  }
  
  try {
    // Build spending context
    const lastMonth = monthlyData[0];
    const previousMonth = monthlyData[1];
    
    const spendingContext = `
User's Spending Data (Last 6 months):

Last Month (${lastMonth.month}):
- Total: ₹${lastMonth.total.toLocaleString('en-IN')}
- Food: ₹${lastMonth.breakdown.food.toLocaleString('en-IN')}
- Travel: ₹${lastMonth.breakdown.travel.toLocaleString('en-IN')}
- Entertainment: ₹${lastMonth.breakdown.entertainment.toLocaleString('en-IN')}
- Shopping: ₹${lastMonth.breakdown.shopping.toLocaleString('en-IN')}
- Others: ₹${lastMonth.breakdown.others.toLocaleString('en-IN')}

${previousMonth ? `Previous Month (${previousMonth.month}):
- Total: ₹${previousMonth.total.toLocaleString('en-IN')}
- Food: ₹${previousMonth.breakdown.food.toLocaleString('en-IN')}
- Travel: ₹${previousMonth.breakdown.travel.toLocaleString('en-IN')}
- Entertainment: ₹${previousMonth.breakdown.entertainment.toLocaleString('en-IN')}
- Shopping: ₹${previousMonth.breakdown.shopping.toLocaleString('en-IN')}
- Others: ₹${previousMonth.breakdown.others.toLocaleString('en-IN')}` : ''}

6-Month Category Totals:
- Food: ₹${categoryTotals.food.toLocaleString('en-IN')} (${Math.round((categoryTotals.food/grandTotal)*100)}%)
- Travel: ₹${categoryTotals.travel.toLocaleString('en-IN')} (${Math.round((categoryTotals.travel/grandTotal)*100)}%)
- Entertainment: ₹${categoryTotals.entertainment.toLocaleString('en-IN')} (${Math.round((categoryTotals.entertainment/grandTotal)*100)}%)
- Shopping: ₹${categoryTotals.shopping.toLocaleString('en-IN')} (${Math.round((categoryTotals.shopping/grandTotal)*100)}%)
- Others: ₹${categoryTotals.others.toLocaleString('en-IN')} (${Math.round((categoryTotals.others/grandTotal)*100)}%)

Grand Total (6 months): ₹${grandTotal.toLocaleString('en-IN')}
`;

    const prompt = `You are a smart financial analyst. Analyze this spending data and provide HIDDEN INSIGHTS that the user WON'T notice just by looking at pie/bar charts.

${spendingContext}

Provide EXACTLY 4 NON-OBVIOUS insights (each under 100 characters). Focus on:

1. HIDDEN PATTERN: A trend the user might not notice (e.g., "Your food spending creeps up ₹500 every month" or "Travel always spikes after low entertainment months")

2. SURPRISING FACT: Something unexpected (e.g., "Your 'Others' category is 3x your entertainment - worth reviewing what's in there" or "You spend more on travel than food+entertainment combined")

3. SMART SAVING TIP: A specific, actionable tip based on THEIR data (e.g., "Cutting 'Others' by 20% saves ₹4,000/month" or "Your entertainment is already minimal - focus on food instead")

4. PREDICTION/WARNING: Project future spending or warn about a trend (e.g., "At this rate, you'll spend ₹2L on travel this year" or "Food spending doubled in 3 months - watch out")

Rules:
- DO NOT state obvious facts visible in charts (like "Food is your top category")
- DO NOT just repeat percentages the user can see
- Be specific with ₹ amounts and percentages
- Each insight should make the user think "I didn't realize that!"
- Be direct and useful, not generic

Format: JSON array of 4 strings only. Example:
["Hidden pattern insight", "Surprising fact", "Specific saving tip", "Prediction or warning"]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status, response.statusText);
      return {
        points: generateFallbackSummary(monthlyData, categoryTotals, grandTotal),
        source: 'fallback'
      };
    }

    const result = await response.json();
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    // Parse JSON array from response
    try {
      // Extract JSON array from response (handle markdown code blocks)
      let jsonStr = textResponse;
      if (textResponse.includes('```')) {
        jsonStr = textResponse.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      
      const summaryPoints = JSON.parse(jsonStr);
      
      if (Array.isArray(summaryPoints) && summaryPoints.length > 0) {
        return {
          points: summaryPoints.slice(0, 4), // Ensure max 4 points
          source: 'ai'
        };
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      // Try to extract points manually
      const lines = textResponse.split('\n').filter(line => line.trim());
      if (lines.length >= 3) {
        return {
          points: lines.slice(0, 4).map(line => line.replace(/^[\d\.\-\*]\s*/, '').trim()),
          source: 'ai'
        };
      }
    }
    
    return {
      points: generateFallbackSummary(monthlyData, categoryTotals, grandTotal),
      source: 'fallback'
    };
    
  } catch (error) {
    console.error('Error calling Gemini for summary:', error.message);
    return {
      points: generateFallbackSummary(monthlyData, categoryTotals, grandTotal),
      source: 'fallback'
    };
  }
}

/**
 * Generate fallback summary without AI
 */
function generateFallbackSummary(monthlyData, categoryTotals, grandTotal) {
  const lastMonth = monthlyData[0];
  const previousMonth = monthlyData[1];
  const summary = [];
  
  // Calculate trends and patterns
  const monthlyTotals = monthlyData.map(m => m.total);
  const avgMonthly = grandTotal / monthlyData.filter(m => m.total > 0).length || 0;
  
  // Find categories with interesting patterns
  let fastestGrowing = null;
  let maxGrowth = 0;
  
  if (previousMonth && lastMonth.total > 0 && previousMonth.total > 0) {
    CATEGORIES.forEach(cat => {
      const lastAmt = lastMonth.breakdown[cat] || 0;
      const prevAmt = previousMonth.breakdown[cat] || 0;
      if (prevAmt > 0) {
        const growth = ((lastAmt - prevAmt) / prevAmt) * 100;
        if (growth > maxGrowth && growth > 20) {
          maxGrowth = growth;
          fastestGrowing = cat;
        }
      }
    });
  }
  
  // Point 1: Hidden Pattern
  if (fastestGrowing) {
    summary.push(`${fastestGrowing.charAt(0).toUpperCase() + fastestGrowing.slice(1)} spending jumped ${Math.round(maxGrowth)}% - a trend to watch`);
  } else if (categoryTotals.others > categoryTotals.food + categoryTotals.entertainment) {
    summary.push(`Your 'Others' exceeds Food + Entertainment combined - review what's in there`);
  } else {
    const variation = Math.round((Math.max(...monthlyTotals) - Math.min(...monthlyTotals.filter(t => t > 0))) / avgMonthly * 100);
    summary.push(`Your monthly spending varies by ${variation}% - budgeting could help stabilize`);
  }
  
  // Point 2: Surprising Fact
  const sortedCats = CATEGORIES.map(cat => ({ cat, amount: categoryTotals[cat] }))
    .sort((a, b) => b.amount - a.amount);
  if (sortedCats[0].amount > sortedCats[1].amount + sortedCats[2].amount) {
    summary.push(`${sortedCats[0].cat.charAt(0).toUpperCase() + sortedCats[0].cat.slice(1)} alone is more than ${sortedCats[1].cat} + ${sortedCats[2].cat} combined!`);
  } else {
    const lowestCat = sortedCats[sortedCats.length - 1];
    const highestCat = sortedCats[0];
    const ratio = Math.round(highestCat.amount / (lowestCat.amount || 1));
    summary.push(`You spend ${ratio}x more on ${highestCat.cat} than ${lowestCat.cat}`);
  }
  
  // Point 3: Smart Saving Tip
  const highestCat = sortedCats[0];
  const savingAmount = Math.round(highestCat.amount * 0.15);
  summary.push(`Cutting ${highestCat.cat} by 15% saves ₹${savingAmount.toLocaleString('en-IN')} over 6 months`);
  
  // Point 4: Prediction
  const yearProjection = Math.round(avgMonthly * 12);
  summary.push(`At current pace, you'll spend ₹${yearProjection.toLocaleString('en-IN')} this year`);
  
  return summary;
}

module.exports = router;
