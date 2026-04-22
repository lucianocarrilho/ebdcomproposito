import * as ftp from "basic-ftp";

async function testFTP() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  
  console.log("Testing with secure: false ...");
  try {
    await client.access({
      host: "147.79.89.224",
      user: "u223033896",
      password: "iS5@TPUE8V",
      secure: false
    });
    console.log("SUCCESS with secure: false");
    return;
  } catch(e) {
    console.log("FAILED secure: false ->", e.message);
  }
  
  client.close();
  
  const client2 = new ftp.Client();
  client2.ftp.verbose = true;
  console.log("\nTesting with secure: true ...");
  try {
    await client2.access({
      host: "147.79.89.224",
      user: "u223033896",
      password: "iS5@TPUE8V",
      secure: true,
      secureOptions: { rejectUnauthorized: false }
    });
    console.log("SUCCESS with secure: true");
    return;
  } catch(e) {
    console.log("FAILED secure: true ->", e.message);
  }
  
  client2.close();
}

testFTP();
