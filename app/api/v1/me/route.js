export async function GET(req) {
  const origin = req.headers.get("origin");
  
  try {
    // 1. First, check if they are Staff
    const staffAuth = await verifyStaff(req);
    if (!staffAuth.error) {
      return json({ 
        authenticated: true, 
        role: 'staff',
        user: { 
          id: staffAuth.staff_id,
          name: staffAuth.name || "Staff Member", 
        } 
      }, 200, origin);
    }

    // 2. If not Staff, check if they are a regular User/Customer
    const userAuth = await verifyUser(req); 
    if (!userAuth.error) {
      return json({ 
        authenticated: true, 
        role: 'user',
        user: { 
          id: userAuth.user_id,
          phone: userAuth.phone,
        } 
      }, 200, origin);
    }

    // 3. Neither? Then they are a Guest
    return json({ authenticated: false, role: 'guest' }, 200, origin);

  } catch (err) {
    console.error("Auth check failed:", err);
    return json({ authenticated: false, role: 'guest' }, 200, origin);
  }
}