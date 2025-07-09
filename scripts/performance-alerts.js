#!/usr/bin/env node
// Performance alerting script

import { performanceAnalytics, performanceAlerting } from '../app/lib/performance-dashboard.server.js';

async function checkAlerts() {
  try {
    console.log('🚨 Checking performance alerts...');

    const alerting = new performanceAlerting(performanceAnalytics, {
      webhookUrl: process.env.PERFORMANCE_WEBHOOK_URL,
      slackToken: process.env.SLACK_BOT_TOKEN
    });

    await alerting.checkAndSendAlerts();

    const alerts = await performanceAnalytics.generateAlerts();
    
    if (alerts.length === 0) {
      console.log('✅ No performance alerts detected');
    } else {
      console.log(`⚠️  Found ${alerts.length} performance alert(s):`);
      
      alerts.forEach(alert => {
        const icon = alert.severity === 'critical' ? '🔴' : 
                    alert.severity === 'high' ? '🟠' : 
                    alert.severity === 'medium' ? '🟡' : '🟢';
        
        console.log(`   ${icon} ${alert.title}`);
        console.log(`      ${alert.message}`);
        if (alert.metric && alert.currentValue !== undefined && alert.threshold !== undefined) {
          console.log(`      Current: ${alert.currentValue} | Threshold: ${alert.threshold}`);
        }
        console.log('');
      });
    }

    // Generate recommendations
    const recommendations = await performanceAnalytics.generateRecommendations();
    if (recommendations.length > 0) {
      console.log('💡 Performance Recommendations:');
      recommendations
        .filter(rec => rec.priority === 'high')
        .forEach(rec => {
          console.log(`   🔧 ${rec.title}`);
          console.log(`      ${rec.description}`);
          console.log(`      Impact: ${rec.impact} | Effort: ${rec.effort}`);
          console.log('');
        });
    }

  } catch (error) {
    console.error('❌ Failed to check performance alerts:', error);
    process.exit(1);
  }
}

checkAlerts();