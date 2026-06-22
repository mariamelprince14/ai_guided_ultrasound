import subprocess
import re
import os
import time

def start_localtunnel():
    print("[TUNNEL] Attempting to start localtunnel on port 8000...")
    proc = subprocess.Popen(
        ["npx", "-y", "localtunnel", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    return proc

def start_serveo():
    print("[TUNNEL] Attempting to start Serveo (SSH tunnel) on port 8000...")
    # Using StrictHostKeyChecking=no to avoid prompt blockages on first connection
    proc = subprocess.Popen(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-R", "80:localhost:8000", "serveo.net"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    return proc

def main():
    tunnel_file = os.path.join(os.path.dirname(__file__), "tunnel_url.txt")
    proc = None
    using_fallback = False

    # Start with localtunnel
    proc = start_localtunnel()
    
    try:
        # We will monitor localtunnel for up to 8 seconds to see if it succeeds.
        # If it prints "tunnel is unavailable" or doesn't print a URL, we switch to serveo.net.
        start_time = time.time()
        url_captured = False

        while True:
            # Check if process terminated
            if proc.poll() is not None:
                print(f"[TUNNEL] Localtunnel process exited with code {proc.returncode}")
                break

            # Read line with timeout check
            line = proc.stdout.readline()
            if not line:
                break
            
            print(f"[localtunnel] {line.strip()}")

            if "your url is:" in line:
                match = re.search(r"your url is:\s*(https?://[^\s]+)", line)
                if match:
                    url = match.group(1).strip()
                    print(f"\n[TUNNEL] Captured URL: {url}")
                    with open(tunnel_file, "w") as f:
                        f.write(url)
                    print(f"[TUNNEL] Saved to {tunnel_file}\n")
                    url_captured = True
                    break
            
            if "tunnel is unavailable" in line or "error" in line.lower():
                print("[TUNNEL] Localtunnel reported an error.")
                break

            # Timeout after 8 seconds of no URL capture
            if time.time() - start_time > 8.0:
                print("[TUNNEL] Localtunnel connection timed out.")
                break

        # Fallback to Serveo if localtunnel failed to capture a URL
        if not url_captured:
            print("[TUNNEL] Switching to Serveo fallback...")
            proc.terminate()
            proc.wait()
            
            proc = start_serveo()
            using_fallback = True
            
            for line in iter(proc.stdout.readline, ""):
                print(f"[serveo] {line.strip()}")
                
                # Check for Serveo's success message: "Forwarding HTTP traffic from https://..."
                if "Forwarding HTTP traffic from" in line:
                    match = re.search(r"Forwarding HTTP traffic from\s*(https?://[^\s]+)", line)
                    if match:
                        url = match.group(1).strip()
                        print(f"\n[TUNNEL] Captured Serveo URL: {url}")
                        with open(tunnel_file, "w") as f:
                            f.write(url)
                        print(f"[TUNNEL] Saved to {tunnel_file}\n")
                        break
                
                # If ssh fails/exits
                if proc.poll() is not None:
                    print(f"[TUNNEL] Serveo process exited with code {proc.returncode}")
                    break

        # Keep running to maintain the active tunnel
        while True:
            line = proc.stdout.readline()
            if not line:
                break
            # Silent output once connected or log it
            prefix = "[serveo]" if using_fallback else "[localtunnel]"
            # Only print error messages or disconnect events
            if "error" in line.lower() or "closed" in line.lower():
                print(f"{prefix} {line.strip()}")

    except KeyboardInterrupt:
        print("\n[TUNNEL] Stopping tunnel...")
    finally:
        if os.path.exists(tunnel_file):
            try:
                os.remove(tunnel_file)
            except Exception:
                pass
        if proc:
            proc.terminate()
            proc.wait()
        print("[TUNNEL] Cleanup complete.")

if __name__ == "__main__":
    main()
