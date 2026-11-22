import Image from "next/image";
import styles from "./android-download.module.css";

const releases = "https://github.com/ayerkhalix/unlockparadise/releases";
const androidRelease = {
  tag: "android-v0.1.0-beta.1",
  version: "0.1.0",
  asset: "Unlock-Paradise-0.1.0-vertical-discovery.apk",
  size: "138 MB",
};
const releaseUrl = `${releases}/tag/${androidRelease.tag}`;
const downloadUrl = `${releases}/download/${androidRelease.tag}/${androidRelease.asset}`;

export function AndroidDownload() {
  return (
    <section
      id="android-app"
      aria-labelledby="android-app-title"
      tabIndex={-1}
      className={styles.section}
    >
      <div className={styles.content}>
        <h2 id="android-app-title">Unlock Paradise for Android</h2>
        <p>
          Explore the Palawan map, save places to your Bucketlist, and build
          itineraries from your phone.
        </p>
        <div className={styles.actions}>
          <a className="p2-button" href={downloadUrl}>
            Download Android APK
          </a>
          <a className={styles.releaseLink} href={releaseUrl}>
            GitHub release
          </a>
        </div>
        <p className={styles.version}>
          Android beta · v{androidRelease.version} · {androidRelease.size}
        </p>
        <details className={styles.install}>
          <summary>How to install</summary>
          <p>
            On your Android phone, open the downloaded APK and tap Install. If
            Android asks for permission, open Settings and allow installs from
            the browser or file app you used to open the download.
          </p>
        </details>
      </div>
      <div className={styles.preview}>
        <Image
          src="/site/optimized/android-app-preview.webp"
          alt="The Explore Palawan map and photo categories in the Android app"
          width={640}
          height={1422}
          unoptimized
        />
      </div>
    </section>
  );
}
