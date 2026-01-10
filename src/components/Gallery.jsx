// import pic1 from "../assets/pic1.jpg";
// import pic2 from "../assets/pic2.jpg";
// import pic3 from "../assets/pic3.jpg";
// import pic4 from "../assets/pic4.jpg";
// import pic5 from "../assets/pic5.jpg";
// import pic6 from "../assets/pic6.jpg";
// import "./Gallery.css"; // import the CSS file

// function Gallery() {
//   return (
//     <div
//       style={{
//         display: "grid",
//         gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
//         gap: "10px",
//       }}
//     >
//       <img src={pic1} />
//       <img src={pic2} />
//       <img src={pic3} />
//       <img src={pic4} />
//       <img src={pic5} />
//       <img src={pic6} />
//     </div>
//   );
// }

// export default Gallery;

const images = [
  "/gallery/pic1.jpg",
  "/gallery/pic2.jpg",
  "/gallery/pic3.jpg",
  "/gallery/pic4.jpg",
  "/gallery/pic5.jpg",
  "/gallery/pic6.jpg", 
];

{images.map((src, i) => (
  <img key={i} src={src} alt="" />
))}