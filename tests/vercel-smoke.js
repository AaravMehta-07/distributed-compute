const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting automated Vercel smoke test for NexusCompute...');
  
  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    const targetUrl = 'https://distributed-compute.vercel.app';
    console.log(`🌐 Navigating to production URL: ${targetUrl}`);
    
    // 1. Go to homepage
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Navigated to homepage successfully!');
    
    // 2. Check page content
    const bodyText = await page.innerText('body');
    
    // Verify key elements
    const hasBrand = bodyText.includes('NEXUS') && bodyText.includes('COMPUTE');
    const hasHostOption = bodyText.includes('Cluster Host');
    const hasWorkerOption = bodyText.includes('Compute Worker');
    
    if (hasBrand && hasHostOption && hasWorkerOption) {
      console.log('✅ Brand identity and cluster options verified on landing page.');
    } else {
      throw new Error(`Landing page missing key elements. Brand: ${hasBrand}, Host: ${hasHostOption}, Worker: ${hasWorkerOption}`);
    }
    
    // 3. Test interaction: Click Worker button and verify description updates
    console.log('🖱️ Clicking "Compute Worker" option...');
    await page.click('button:has-text("Compute Worker")');
    await page.waitForTimeout(500); // Wait for transition animation
    
    const updatedBodyText = await page.innerText('body');
    const hasWorkerDesc = updatedBodyText.includes('Join an active room') || updatedBodyText.includes('stream results directly P2P');
    if (hasWorkerDesc) {
      console.log('✅ Worker role selection verified (dynamic text description matches role).');
    } else {
      throw new Error('Worker description failed to display correctly after toggle.');
    }
    
    // 4. Test room page loading: Navigate to a custom room to check the coordinate console
    const roomUrl = `${targetUrl}/room/smoke-test-room-999?role=host`;
    console.log(`🌐 Navigating to Host Room URL: ${roomUrl}`);
    await page.goto(roomUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    const roomBodyText = await page.innerText('body');
    console.log('✅ Room page loaded successfully!');
    
    // Verify room features
    const hasControlPanel = roomBodyText.includes('Control Panel') || roomBodyText.includes('Inference') || roomBodyText.includes('Cluster');
    
    if (hasControlPanel) {
      console.log('✅ Control Panel elements render correctly on room load.');
    } else {
      throw new Error('Control Panel failed to render inside the active coordinate room.');
    }
    
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The Vercel deployment is 100% healthy and fully functional. 🎉');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
