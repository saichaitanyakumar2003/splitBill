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
    const aiSummary = await generateAISummary(monthlyData, categoryTotals, grandTotal);
    
    // Record the API call
    const usageResult = await AISummaryUsage.recordCall(mailId);
    
    res.json({
      success: true,
      data: {
        summary: aiSummary,
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
    console.log('Gemini API key not configured, returning default summary');
    return generateFallbackSummary(monthlyData, categoryTotals, grandTotal);
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

    const prompt = `You are a helpful financial advisor analyzing a user's spending patterns. Based on the following spending data, provide personalized insights.

${spendingContext}

Provide EXACTLY 5 short bullet points (each under 80 characters) covering:
1. Where they spent the most last month
2. Month-over-month change (if applicable)
3. Their highest spending category overall
4. One specific saving tip based on their spending pattern
5. A positive observation or encouragement

Rules:
- Keep each point concise (under 80 characters)
- Use ₹ symbol for amounts
- Be specific with numbers and percentages
- Be encouraging, not judgmental
- Focus on actionable insights

Format your response as a JSON array of 5 strings, nothing else. Example:
["Point 1 here", "Point 2 here", "Point 3 here", "Point 4 here", "Point 5 here"]`;

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
      return generateFallbackSummary(monthlyData, categoryTotals, grandTotal);
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
        return summaryPoints.slice(0, 5); // Ensure max 5 points
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      // Try to extract points manually
      const lines = textResponse.split('\n').filter(line => line.trim());
      if (lines.length >= 3) {
        return lines.slice(0, 5).map(line => 
          line.replace(/^[\d\.\-\*]\s*/, '').trim()
        );
      }
    }
    
    return generateFallbackSummary(monthlyData, categoryTotals, grandTotal);
    
  } catch (error) {
    console.error('Error calling Gemini for summary:', error.message);
    return generateFallbackSummary(monthlyData, categoryTotals, grandTotal);
  }
}

/**
 * Generate fallback summary without AI
 */
function generateFallbackSummary(monthlyData, categoryTotals, grandTotal) {
  const lastMonth = monthlyData[0];
  const previousMonth = monthlyData[1];
  
  // Find highest spending category
  let highestCat = 'others';
  let highestAmount = 0;
  CATEGORIES.forEach(cat => {
    if (categoryTotals[cat] > highestAmount) {
      highestAmount = categoryTotals[cat];
      highestCat = cat;
    }
  });
  
  // Find highest spending category last month
  let highestLastMonth = 'others';
  let highestLastAmount = 0;
  CATEGORIES.forEach(cat => {
    if (lastMonth.breakdown[cat] > highestLastAmount) {
      highestLastAmount = lastMonth.breakdown[cat];
      highestLastMonth = cat;
    }
  });
  
  const summary = [];
  
  // Point 1: Last month highest
  if (lastMonth.total > 0) {
    const percentage = Math.round((highestLastAmount / lastMonth.total) * 100);
    summary.push(`${highestLastMonth.charAt(0).toUpperCase() + highestLastMonth.slice(1)} was your top spend last month (${percentage}%)`);
  } else {
    summary.push('No spending recorded last month');
  }
  
  // Point 2: Month comparison
  if (previousMonth && previousMonth.total > 0 && lastMonth.total > 0) {
    const change = lastMonth.total - previousMonth.total;
    const changePercent = Math.round((change / previousMonth.total) * 100);
    if (change > 0) {
      summary.push(`Spending increased by ${changePercent}% from previous month`);
    } else if (change < 0) {
      summary.push(`Great! Spending decreased by ${Math.abs(changePercent)}% from last month`);
    } else {
      summary.push('Spending remained stable compared to previous month');
    }
  } else {
    summary.push('Keep tracking to see monthly trends');
  }
  
  // Point 3: Overall category
  const overallPercent = Math.round((highestAmount / grandTotal) * 100);
  summary.push(`${highestCat.charAt(0).toUpperCase() + highestCat.slice(1)} is your biggest expense category (${overallPercent}%)`);
  
  // Point 4: Saving tip based on highest category
  const savingTips = {
    food: 'Try meal planning to reduce food expenses',
    travel: 'Consider carpooling or public transport to save',
    entertainment: 'Look for free events or subscription bundles',
    shopping: 'Make a wishlist and wait 48hrs before buying',
    others: 'Review recurring bills for potential savings'
  };
  summary.push(savingTips[highestCat]);
  
  // Point 5: Encouragement
  summary.push('Tracking expenses is the first step to financial health!');
  
  return summary;
}

module.exports = router;
