// Diagnostic script for Supabase connection
// Run with: node test-supabase.js

console.log('🔍 Testing Supabase Connection...\n');
console.log('⚠️  Note: This script requires the app to be running or use the browser console instead.\n');
console.log('Alternative: Open browser console in your running app and run these checks:\n');
console.log('1. Check Supabase URL:');
console.log('   console.log(supabase.supabaseUrl)\n');
console.log('2. Check session:');
console.log('   supabase.auth.getSession().then(({data}) => console.log(data))\n');
console.log('3. Check storage buckets:');
console.log('   supabase.storage.listBuckets().then(({data}) => console.log(data))\n');
console.log('4. Check drivers table:');
console.log('   supabase.from("drivers").select("id").limit(1).then(({data, error}) => console.log({data, error}))\n');

// For Node.js testing, we'd need to use dynamic import
async function testConnection() {
    try {
        console.log('💡 For full diagnostic, please:');
        console.log('   1. Open your app in browser (npm run dev)');
        console.log('   2. Open browser DevTools (F12)');
        console.log('   3. Go to Console tab');
        console.log('   4. Run the commands shown above\n');
    } catch (error) {
        console.error('Error:', error);
    }
}

testConnection();

console.log('🔍 Testing Supabase Connection...\n');

async function testConnection() {
    try {
        // Test 1: Check Supabase client initialization
        console.log('✅ Supabase client initialized');
        console.log('📍 URL:', supabase.supabaseUrl);

        // Test 2: Check authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.log('❌ Session error:', sessionError.message);
        } else if (session) {
            console.log('✅ User authenticated:', session.user.email);
        } else {
            console.log('⚠️  No active session - user needs to login first');
        }

        // Test 3: Check storage bucket exists
        console.log('\n🗄️  Checking storage bucket...');
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

        if (bucketError) {
            console.log('❌ Error listing buckets:', bucketError.message);
        } else {
            const driverDocsBucket = buckets.find(b => b.id === 'driver-docs');
            if (driverDocsBucket) {
                console.log('✅ Storage bucket "driver-docs" exists');
                console.log('   Public:', driverDocsBucket.public);
            } else {
                console.log('❌ Storage bucket "driver-docs" NOT FOUND');
                console.log('   Available buckets:', buckets.map(b => b.id).join(', '));
                console.log('\n📝 Action Required: Create "driver-docs" bucket in Supabase dashboard');
            }
        }

        // Test 4: Check drivers table access
        console.log('\n📊 Checking drivers table...');
        const { data: drivers, error: tableError } = await supabase
            .from('drivers')
            .select('id')
            .limit(1);

        if (tableError) {
            console.log('❌ Error accessing drivers table:', tableError.message);
            if (tableError.message.includes('relation') || tableError.message.includes('does not exist')) {
                console.log('   Table might not exist or RLS policies are blocking access');
            }
        } else {
            console.log('✅ Drivers table accessible');
        }

        console.log('\n✨ Diagnostic complete!');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

testConnection();
